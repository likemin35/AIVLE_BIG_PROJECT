# analyze_terms.py
from __future__ import annotations

import os, re, json, uuid, logging, sys
from datetime import datetime, timezone
from typing import List

from flask import Flask, request, jsonify
from flask_cors import CORS

# --- Chroma 버전 로깅(디버그용) ---
try:
    import chromadb  # noqa
    logging.basicConfig(level=logging.INFO)
    logging.info(f"[BOOT] chromadb version: {chromadb.__version__}")
except Exception:
    pass

# Google / Vertex
import vertexai
from google.oauth2 import service_account
from google.cloud import secretmanager

# LangChain / RAG
from langchain_community.document_loaders import PyPDFDirectoryLoader, PyPDFLoader
from langchain_huggingface.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_google_vertexai import ChatVertexAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain.text_splitter import RecursiveCharacterTextSplitter

# Upload
from werkzeug.utils import secure_filename
try:
    from docx import Document
except Exception:
    Document = None


# =============================================================================
# Flask
# =============================================================================
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})
logging.getLogger("werkzeug").setLevel(logging.INFO)

# =============================================================================
# Config / Env
# =============================================================================
PROJECT_ID = os.environ.get("GCP_PROJECT", "aivle-team0721")
LOCATION   = os.environ.get("GCP_LOCATION", "us-central1")
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
LOCAL_KEY_FILE = os.path.join(BASE_DIR, "firebase-adminsdk.json")

# Vector DB root (1.x 포맷 폴더)
RAG_ROOT = os.environ.get("CHROMA_BASE", os.path.join(BASE_DIR, "판례_1x"))

LAW_VECTOR_DB_MAP = {
    "insurance": os.path.join(RAG_ROOT, "chroma_db_insurance"),
    "deposit":   os.path.join(RAG_ROOT, "chroma_db_deposit"),
    "loan":      os.path.join(RAG_ROOT, "chroma_db_loan"),
}

# 카테고리 정규화
_ALIAS = {
    "insurance": {"insurance","보험","보험(암 포함)","보험(일반)","암보험"},
    "deposit":   {"deposit","예금","적금","savings"},
    "loan":      {"loan","대출"},
}
_ALIAS_FLAT = {v.strip().lower().replace(" ", ""): k
               for k, vs in _ALIAS.items() for v in vs}

def normalize_category(cat: str|None) -> str|None:
    if not cat:
        return None
    return _ALIAS_FLAT.get(cat.strip().lower().replace(" ", ""))

# 업로드 저장 폴더
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 검색 파라미터(서버 고정)
TOP_K_DEFAULT = int(os.environ.get("ANALYZE_TOP_K", "6"))
THRESHOLD_DEFAULT = float(os.environ.get("ANALYZE_THRESHOLD", "0.35"))
MAX_QUERY_CHARS = int(os.environ.get("MAX_QUERY_CHARS", "1500"))

# =============================================================================
# Vertex / LLM / Embeddings
# =============================================================================
credentials = None
try:
    secret_client = secretmanager.SecretManagerServiceClient()
    secret_name   = f"projects/{PROJECT_ID}/secrets/firebase-adminsdk/versions/latest"
    payload = secret_client.access_secret_version(name=secret_name).payload.data.decode("utf-8")
    credentials = service_account.Credentials.from_service_account_info(json.loads(payload))
    logging.info("[BOOT] Secret Manager 자격증명 로드 성공")
except Exception as e:
    logging.warning(f"[BOOT] Secret Manager 실패 → 로컬 키 사용 시도: {e}")
    try:
        if not os.path.exists(LOCAL_KEY_FILE):
            raise FileNotFoundError("로컬 서비스 계정 키 없음: " + LOCAL_KEY_FILE)
        credentials = service_account.Credentials.from_service_account_file(LOCAL_KEY_FILE)
        logging.info("[BOOT] 로컬 자격증명 로드 성공")
    except Exception as file_e:
        logging.error(f"[BOOT] 자격증명 초기화 실패: {file_e}")
        credentials = None

llm = None
embedding_model = None
if credentials:
    try:
        vertexai.init(project=PROJECT_ID, location=LOCATION, credentials=credentials)
        llm = ChatVertexAI(
            model_name="gemini-2.5-flash-lite",
            project=PROJECT_ID,
            location=LOCATION,
            credentials=credentials,
            temperature=0.2,
            max_output_tokens=8192,
        )
        embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        logging.info("[BOOT] Vertex AI 및 임베딩 초기화 성공")
    except Exception:
        logging.exception("[BOOT] Vertex/LLM 초기화 실패")
else:
    logging.error("[BOOT] 자격증명 없음 → LLM/임베딩 사용 불가")

# =============================================================================
# Prompt / Chain
# =============================================================================
judgment_prompt = ChatPromptTemplate.from_template("""
당신은 기업에서 약관 리스크를 전문적으로 점검하는 법률 전문가입니다.

입력:
- 검토 대상 약관 조항({clause})   # ← 제목이 제거된 '본문'만 전달됨
- 실제 판례 발췌 모음({similar_cases})

필수 규칙:
1) 약관 조항 중 ‘리스크(모호함, 명확성 부족, 설명의무 위반, 오탈자, 보험자/피보험자 바뀜)’가 발견되는 부분만 골라주세요.
2) 약관 조항을 "문서에 나온 순서(제1조→제2조→…)" 그대로 검사하고,
   문제가 발견된 조항만 그 **등장 순서 그대로** 출력하세요. 순서를 바꾸거나 묶어서 합치지 마세요.
3) 한 조항당 **하나의 결과 블록**만 작성하세요. 다른 조항 내용과 섞지 마세요.
4) 리스크는 반드시 similar_cases 안의 **실제 판례**와 연결되는 경우에만 적으세요. (없는/가공 판례 금지)
5) 모호하거나 일반론적인 표현(예: "법정연체이율", "회사가 정한 납입일", "일정 기간", "소정의 금액")이 있으면
   소비자가 즉시 이해할 수 있도록 **구체 값·기준·기한**을 제시하세요.
   - 예) "법정연체이율"만 있으면: 현재 통용되는 산식/범위 예시와 함께 **수치(연 %)**를 제안
   - 예) "회사가 정한 납입일"만 있으면: **구체적 납입기일(예: 매월 말일 24:00, 공휴일이면 다음 영업일)**로 명시하도록 제안
   - 근거 수치가 문서/판례에 없으면, 그 모호성을 **리스크로 지적**하고,
     **실무에서 통용되는 합리적 예시값**을 붙여 **명확 문구 제안**을 하세요(“~로 한정”, “~로 정의” 등).
6) 관련 판례가 **없는** 경우에는 출력 블록에서 **‘관련 판례:’ 줄을 완전히 생략**하세요.
7) 아무런 리스크가 없으면 **그 조항은 아예 출력하지 마세요.**
8) 결과는 **순수 텍스트**만 쓰고, 머리말/꼬리말/요약/마크다운/불릿/번호 체계 등 **어떠한 추가 문구도 금지**합니다.
9) **첫 줄은 반드시 ‘조항 본문에서 발췌한 핵심 문장’만 적고, ‘제 1 조 (목적)’ 같은 제목은 쓰지 마세요.**
10) **‘관련 판례:’는 한 줄 요약만**, 형식 예: `관련 판례: 대법원 2018.3.15. (2017다12345) – 고지의무 범위 한정`. 
    (날짜/사건번호가 없으면 법원+핵심요지만 간결히)

출력 형식(조항 하나당 아래 3~4줄, 판례가 없으면 3줄, 리스크가 없으면 아무것도 출력하지 않음):
[문제가 되는 조항] 원문 일부/핵심 문장      ← 제목 금지 (본문 문장만)
설명: 무엇이 왜 문제인지(모호·불명확·설명의무 위반 등). 필요한 경우 **구체 수치/기한/기준**을 들어 설명.
수정 제안: 소비자가 즉시 이해할 수 있도록 **구체 문구**로 재작성(수치·기한·정의 포함). 예시값 제시 가능.
관련 판례: (선택) 한 줄 요약 (법원/날짜/사건번호/핵심요지 중 가능한 정보만)

아래 입력을 검토해 위 형식으로, **문서 등장 순서대로** 필요한 블록만 출력하세요.
{clause}
{similar_cases}
""")

judgment_chain = (judgment_prompt | llm | StrOutputParser()) if llm else None

# =============================================================================
# Helpers
# =============================================================================
CLAUSE_HEADER = r"제\s*\d+\s*조"
CLAUSE_REGEX  = re.compile(rf"({CLAUSE_HEADER}\s*(?:\([^)]+\))?[\s\S]*?)(?={CLAUSE_HEADER}|$)")
TITLE_REGEX   = re.compile(rf"^({CLAUSE_HEADER}[^\n\r]*)")

def _split_title_body(block: str):
    m = TITLE_REGEX.search(block)
    if not m:
        return None, block.strip()
    title = m.group(1).strip()
    body  = block[m.end():].strip()
    return title, body

def split_into_clauses(text: str) -> List[dict]:
    raw = text or ""
    matches = CLAUSE_REGEX.findall(raw)

    clauses = []
    if matches:
        for idx, m in enumerate(matches, start=1):
            t, b = _split_title_body(m)
            title = t or f"제{idx}조"
            clauses.append({
                "index": idx,
                "title": title,
                "content": m.strip(),  # 전체 블록(참고용)
                "body": b,             # ← LLM에는 이 '본문'만 보냄
            })
    else:
        splitter = RecursiveCharacterTextSplitter(chunk_size=1200, chunk_overlap=0)
        chunks = splitter.split_text(raw)
        for i, c in enumerate(chunks):
            t, b = _split_title_body(c)
            clauses.append({
                "index": i+1,
                "title": t or f"블록{i+1}",
                "content": c.strip(),
                "body": b or c.strip(),
            })

    # 중복 제거
    seen = set()
    uniq = []
    for c in clauses:
        key = re.sub(r"\s+", "", (c["title"] + "|" + (c["body"][:160] or "")))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)
    return uniq

def load_user_text_from_pdf(pdf_dir: str|None = None, pdf_file: str|None = None) -> str:
    if pdf_file and os.path.isfile(pdf_file):
        docs = PyPDFLoader(pdf_file).load()
    elif pdf_dir and os.path.isdir(pdf_dir):
        docs = PyPDFDirectoryLoader(pdf_dir).load()
    else:
        raise FileNotFoundError("pdf_dir 또는 pdf_file 경로가 올바르지 않습니다.")
    return "".join([d.page_content for d in docs])

def _ensure_1x_vector_dir(path: str):
    """1.x용 안전 점검: 0.4 잔재 index/가 있으면 격리"""
    index_dir = os.path.join(path, "index")
    sqlite_file = os.path.join(path, "chroma.sqlite3")

    if os.path.isdir(index_dir) and not os.path.exists(sqlite_file):
        raise RuntimeError(
            "이 벡터DB 폴더는 Chroma 0.4.x(HNSW) 포맷으로 보입니다. "
            "현재 실행 환경은 chromadb==1.0.15 입니다. "
            "1.x 포맷으로 재생성하거나 0.4.x 환경에서 실행하세요."
        )

    if os.path.isdir(index_dir) and os.path.exists(sqlite_file) and os.environ.get("ALLOW_HNSW_INDEX", "0") != "1":
        try:
            suffix = uuid.uuid4().hex[:6]
            new_name = os.path.join(path, f"index__legacy_{suffix}")
            os.rename(index_dir, new_name)
            logging.warning("[VECTOR] legacy 'index/' 폴더를 %s 로 격리했습니다.", os.path.basename(new_name))
        except Exception as e:
            logging.warning("[VECTOR] 'index/' 격리 실패(계속 진행): %s", e)

def build_vectorstore(path: str) -> Chroma:
    if not os.path.isdir(path):
        raise FileNotFoundError(f"벡터DB 경로가 존재하지 않습니다: {path}")
    _ensure_1x_vector_dir(path)
    logging.info(f"[VECTOR] open (1.x): {os.path.abspath(path)}")
    return Chroma(persist_directory=path, embedding_function=embedding_model)

def _clean_query(q: str) -> str:
    q = re.sub(r"\s+", " ", q or "").strip()
    return q[:MAX_QUERY_CHARS]

def _search_docs(vectorstore: Chroma, query: str, k: int, threshold: float):
    """인덱스 기반 간단 검색: relevance 우선 → 상위 k 백업"""
    q = _clean_query(query)
    try:
        pairs = vectorstore.similarity_search_with_relevance_scores(q, k=k)
        docs = [doc for doc, score in pairs if (score is None or score >= threshold)]
        if docs:
            return docs
    except Exception as e:
        logging.warning(f"[VECTOR] relevance 검색 실패: {e}")

    try:
        return vectorstore.similarity_search(q, k=k)
    except Exception as e3:
        logging.error(f"[VECTOR] 상위 k 백업도 실패: {e3}")
        return []

def analyze_single_clause(clause_text: str, vectorstore: Chroma,
                          top_k: int = TOP_K_DEFAULT, threshold: float = THRESHOLD_DEFAULT) -> str:
    docs = _search_docs(vectorstore, clause_text, k=top_k, threshold=threshold)
    if not docs:
        return ""
    similar_text = "\n\n".join([d.page_content for d in docs])
    out = judgment_chain.invoke({"clause": clause_text, "similar_cases": similar_text}) if judgment_chain else ""
    return (out or "").strip()

def read_txt(path: str) -> str:
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        return f.read()

def read_docx(path: str) -> str:
    if Document is None:
        raise RuntimeError("python-docx가 설치되어 있지 않습니다. pip install python-docx")
    from docx import Document as _D
    doc = _D(path)
    return "\n".join([p.text for p in doc.paragraphs])

# ---- 파일 형식 스니핑 (한글 파일명 대응) ----
def _sniff_ext(file_storage) -> str:
    """원본 파일명 확장자 우선, 없으면 헤더 바이트로 포맷 추정."""
    ext = os.path.splitext((file_storage.filename or "").strip())[1].lower()
    if ext:
        return ext
    head = file_storage.stream.read(4)
    file_storage.stream.seek(0)
    if head.startswith(b"%PDF"):
        return ".pdf"
    if head.startswith(b"PK\x03\x04"):  # zip 기반(docx 등)
        return ".docx"
    return ""  # 모르면 빈 문자열

# =============================================================================
# API
# =============================================================================
@app.route("/api/health", methods=["GET"])
def health():
    return {"ok": True, "service": "analyze_terms", "time": datetime.now(timezone.utc).isoformat()}

@app.route("/__whoami", methods=["GET"])
def whoami():
    routes = sorted([str(r) for r in app.url_map.iter_rules()])
    return {
        "file": __file__,
        "cwd": os.getcwd(),
        "python": sys.executable,
        "routes": routes[:200],
    }

@app.route("/api/debug/routes", methods=["GET"])
def debug_routes():
    rows = []
    for rule in app.url_map.iter_rules():
        rows.append({
            "endpoint": rule.endpoint,
            "methods": sorted(list(rule.methods - {'HEAD','OPTIONS'})),
            "rule": str(rule),
        })
    return {"routes": sorted(rows, key=lambda r: r["rule"])}

@app.route("/api/debug/vector-db", methods=["GET"])
@app.route("/api/debug/vector_db", methods=["GET"])
def debug_vector_db():
    info = {}
    for k, p in LAW_VECTOR_DB_MAP.items():
        p_abs = os.path.abspath(p)
        version = None
        vfile = os.path.join(p_abs, "VERSION")
        if os.path.exists(vfile):
            try:
                with open(vfile, "r", encoding="utf-8") as f:
                    version = f.read().strip()
            except:
                pass
        info[k] = {
            "path": p_abs,
            "exists": os.path.isdir(p_abs),
            "has_sqlite": os.path.exists(os.path.join(p_abs, "chroma.sqlite3")),
            "has_index_dir": os.path.exists(os.path.join(p_abs, "index")),
            "version_file": version,
            "sample": sorted(os.listdir(p_abs))[:12] if os.path.isdir(p_abs) else [],
        }
    return info

@app.route("/api/analyze-terms", methods=["POST"])
def analyze_terms():
    if not llm or not embedding_model:
        return jsonify({"ok": False, "error": "LLM 또는 Embedding 초기화 실패"}), 500

    data = request.get_json(silent=True) or {}
    raw_text = data.get("text")
    category_raw = data.get("category", "")
    category = normalize_category(category_raw)
    vector_db_path = data.get("vector_db_path") or (LAW_VECTOR_DB_MAP.get(category) if category else None)
    limit = int(data.get("limit", 0))  # limit만 허용 (top_k/threshold는 서버 고정)

    try:
        if raw_text and isinstance(raw_text, str) and raw_text.strip():
            full_text = raw_text
        else:
            pdf_dir = data.get("pdf_dir")
            pdf_file = data.get("pdf_file")
            full_text = load_user_text_from_pdf(pdf_dir=pdf_dir, pdf_file=pdf_file)

        if not vector_db_path:
            return jsonify({"ok": False, "error": f"category가 유효하지 않습니다: {category_raw}. 허용: {list(LAW_VECTOR_DB_MAP)}"}), 400

        logging.info(f"[API] /api/analyze-terms category={category} path={vector_db_path}")
        clauses = split_into_clauses(full_text)
        if limit > 0:
            clauses = clauses[:limit]

        vectorstore = build_vectorstore(vector_db_path)

        results, flagged = [], 0
        for c in clauses:  # 문서 등장 순서대로
            # ★ CHANGED: 제목이 아닌 '본문(body)'을 우선 사용
            clause_text_for_llm = (c.get("body") or c.get("content") or "").strip()

            analysis = analyze_single_clause(
                clause_text_for_llm,             # ← 본문만 분석
                vectorstore,
                top_k=TOP_K_DEFAULT,
                threshold=THRESHOLD_DEFAULT
            )
            if analysis:
                flagged += 1
                results.append({
                    "index": c["index"],
                    "title": c["title"],
                    "analysis": analysis
                })


        text_joined = "\n\n".join([r["analysis"] for r in results])

        return jsonify({
            "ok": True,
            "category": category,
            "vector_db_path": vector_db_path,
            "count_clauses": len(clauses),
            "count_flagged": flagged,
            "results": results,
            "text": text_joined,  # 프론트 한 덩어리 출력용
        })
    except Exception as e:
        logging.exception("[API] /api/analyze-terms 오류")
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/analyze-terms-upload", methods=["POST"])
def analyze_terms_upload():
    if not llm or not embedding_model:
        return jsonify({"ok": False, "error": "LLM 또는 Embedding 초기화 실패"}), 500
    if "file" not in request.files:
        return jsonify({"ok": False, "error": "file 필드가 없습니다."}), 400

    f = request.files["file"]
    if not f or (f.filename or "").strip() == "":
        return jsonify({"ok": False, "error": "파일이 비어 있습니다."}), 400

    category_raw = request.form.get("category", "")
    category = normalize_category(category_raw)
    limit = int(request.form.get("limit", 0))  # limit만 허용

    # 확장자 판정(원본 → 헤더 스니핑)
    ext = _sniff_ext(f)
    safe_name = secure_filename(f.filename or f"upload{ext or ''}")
    save_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4().hex}{ext or ''}")
    f.save(save_path)
    logging.info(f"[UPLOAD] name={safe_name} ext={ext!r} saved={save_path}")

    try:
        if ext == ".pdf":
            full_text = load_user_text_from_pdf(pdf_file=save_path)
        elif ext == ".docx":
            full_text = read_docx(save_path)
        elif ext == ".txt" or ext == "":
            full_text = read_txt(save_path)
        else:
            return jsonify({"ok": False, "error": f"지원하지 않는 형식입니다: {ext or '(알 수 없음)'} . txt/pdf/docx만 허용"}), 400

        if not category or category not in LAW_VECTOR_DB_MAP:
            return jsonify({"ok": False, "error": f"category가 유효하지 않습니다: {category_raw}. 허용: {list(LAW_VECTOR_DB_MAP)}"}), 400

        vector_db_path = LAW_VECTOR_DB_MAP[category]
        logging.info(f"[API] /api/analyze-terms-upload category={category} path={vector_db_path}")

        clauses = split_into_clauses(full_text)
        if limit > 0:
            clauses = clauses[:limit]

        vectorstore = build_vectorstore(vector_db_path)

        results, flagged = [], 0
        for c in clauses:  # 문서 등장 순서대로
            # ★ CHANGED: 제목이 아닌 '본문(body)'을 우선 사용
            clause_text_for_llm = (c.get("body") or c.get("content") or "").strip()

            analysis = analyze_single_clause(
                clause_text_for_llm,             # ← 본문만 분석
                vectorstore,
                top_k=TOP_K_DEFAULT,
                threshold=THRESHOLD_DEFAULT
            )
            if analysis:
                flagged += 1
                results.append({
                    "index": c["index"],
                    "title": c["title"],
                    "analysis": analysis
                })


        text_joined = "\n\n".join([r["analysis"] for r in results])

        return jsonify({
            "ok": True,
            "category": category,
            "vector_db_path": vector_db_path,
            "count_clauses": len(clauses),
            "count_flagged": flagged,
            "results": results,
            "text": text_joined,  # 프론트 한 덩어리 출력용
        })
    except Exception as e:
        logging.exception("[API] /api/analyze-terms-upload 오류")
        return jsonify({"ok": False, "error": str(e)}), 500


# =============================================================================
# Run (리로더 끔: 중복 프로세스/포트 혼선 방지)
# =============================================================================
if __name__ == "__main__":
    port = int(os.environ.get("PY_PORT", 8082))
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
