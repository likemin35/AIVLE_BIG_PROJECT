from flask import Flask, request, jsonify, send_file
from flask_cors import CORS, cross_origin
import vertexai
import os, _csv, _io
import json
import logging
import urllib.parse
from datetime import datetime
from google.oauth2 import service_account
from vertexai.generative_models import GenerativeModel
from langchain_huggingface.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
import logging
import requests
from google.cloud import secretmanager
import urllib.parse

# Flask App 초기화 및 CORS 설정
app = Flask(__name__)
# CORS(app, resources={r"/api/*": {"origins": "*"}})

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 서비스 URL
TERM_SERVICE_URL = os.environ.get("TERM_SERVICE_URL", "http://localhost:8083/terms")
POINT_SERVICE_URL = os.environ.get("POINT_SERVICE_URL", "http://localhost:8085")

# Vertex AI 설정
PROJECT_ID = "aivle-team0721"
LOCATION = "us-central1"

# 크로마 DB 저장소 경로

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_KEY_FILE = os.path.join(BASE_DIR, "firebase-adminsdk.json")

try:
    secret_client = secretmanager.SecretManagerServiceClient()
    secret_name = f"projects/{PROJECT_ID}/secrets/firebase-adminsdk/versions/latest"
    response = secret_client.access_secret_version(name=secret_name)
    secret_payload = response.payload.data.decode("UTF-8")
    credentials_info = json.loads(secret_payload)
    credentials = service_account.Credentials.from_service_account_info(credentials_info)
    logging.info("Secret Manager에서 서비스 계정 키 로드 성공")
except Exception as e:
    logging.warning(f"Secret Manager 접근 실패: {e}. 로컬 키 파일로 대체합니다.")
    try:
        if not os.path.exists(LOCAL_KEY_FILE):
            raise FileNotFoundError("로컬 서비스 계정 키 파일을 찾을 수 없습니다: " + LOCAL_KEY_FILE)
        credentials = service_account.Credentials.from_service_account_file(LOCAL_KEY_FILE)
        logging.info("로컬 파일에서 서비스 계정 키 로드 성공")
    except Exception as file_e:
        logging.error(f"AI 서비스 초기화 실패: Secret Manager와 로컬 파일 모두 실패. ({file_e})")
        credentials = None

if credentials:
    try:
        vertexai.init(project=PROJECT_ID, location=LOCATION, credentials=credentials)
        gemini_model = GenerativeModel("gemini-2.5-flash-lite")
        logging.info("Vertex AI 초기화 성공")
    except Exception as e:
        logging.error(f"Vertex AI Gemini 모델 초기화 실패: {e}")
        gemini_model = None
    try:
        embedding = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        logging.info("허깅페이스 임베딩 초기화 성공")
    except Exception as e:
        logging.error(f"허깅페이스 임베딩 초기화 실패: {e}")
        embedding = None
else:
    gemini_model = None

VECTOR_DB_MAP = {
    'loan': os.path.join(BASE_DIR, '대출'),
    'cancer_insurance': os.path.join(BASE_DIR, '암보험'),
    'deposit': os.path.join(BASE_DIR, '예금'),
    'car_insurance': os.path.join(BASE_DIR, '자동차보험'),
    'savings': os.path.join(BASE_DIR, '적금'),
    'laws': os.path.join(BASE_DIR, '법령')
}

PROMPT_TEMPLATE_JSON = r"""
너는 보험 약관 작성 전문가다. 아래 정보를 참고하여 오직 JSON만 출력하라.
텍스트 목차/서문/설명/마크다운/코드블럭/주석/별표(*)는 절대 출력하지 말 것.
만약 출력된다면, 잘못된 결과

입력:
- 기업 이름: {company_name}
- 상품 이름: {product_name}
- 기업 제공 상품 정보(원문):
{wishlist}

- 참고 약관 문서 및 법령자료):
{context}

요구사항:
1) 보장은 구체적 수치·기간·조건으로 명시(추상표현 금지).
2) 독소조항·악용 우려 포인트는 정의/절차/예시로 명확화.
3) 반복 용어는 '용어의 정의'에 1회 정의 후 본문에서는 용어만 사용.
4) 각 절차는 주 경로와 예비 경로 2가지 제시.
5) 최소 6개 관 이상, 총 50개 조 이상. 각 조는 다수의 하위항 포함.
6) '목차'라는 단어 자체를 출력하지 말 것.
7) 아래 JSON 스키마 그대로 출력. 키 누락 금지. 값은 문자열 또는 문자열 리스트만.
8) 자체 점검: 출력 직전에 전체 조(articles) 개수가 50개 이상인지 확인하고, 부족하면 추가 작성하여 50개 이상이 되도록 할 것.

JSON 스키마:
{{
  "title": "문서 제목(예: '{product_name} 약관 초안')",
  "sections": [
    {{
      "name": "제1관 총칙",
      "articles": [
        {{
          "title": "제1조(목적)",
          "clauses": ["① ...", "② ...", "1. ...", "2. ..."]
        }}
      ]
    }}
  ],
  "tables": ["해약환급금", "지급기준표"]
}}

주의:
- 출력은 JSON 본문만.
- 각 조의 'clauses'는 실제 조문을 충분히 길게 작성.
"""

# 공통 CORS 헤더
# @app.after_request
# def after_request(response):
#     response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-authenticated-user-uid')
#     response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
#     return response

# 포인트 URL 안전 생성
def _build_point_reduce_url(base: str, user_id: str, amount: int, reason: str) -> str:
    base = base.rstrip('/')
    if "/api/points" in base:
        return f"{base}/{user_id}/reduce?amount={amount}&reason={reason}"
    else:
        return f"{base}/api/points/{user_id}/reduce?amount={amount}&reason={reason}"

# Gemini 호출
def _gen_with_gemini(prompt: str) -> str:
    try:
        resp = gemini_model.generate_content(
            prompt,
            generation_config={
                "max_output_tokens": 24000,
                "temperature": 0.3
            }
        )
        return resp.candidates[0].content.parts[0].text
    except Exception:
        logging.exception("Gemini 호출 실패")
        raise

# JSON 파서
def _parse_json_loose(raw: str) -> dict:
    try:
        return json.loads(raw)
    except:
        pass
    start = raw.find("{"); end = raw.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = raw[start:end+1]
        try:
            return json.loads(candidate)
        except:
            candidate2 = candidate.replace("“", "\"").replace("”", "\"").replace("’", "'")
            return json.loads(candidate2)
    raise ValueError("LLM JSON 파싱 실패")



# 통합 CSV 파서(업로드용)
def parse_unified_product_csv_upload(file_storage):
    """
    product_info.csv 하나로부터 모든 정보를 파싱한다.
    섹션 구성:
      1) 항목,내용  (Key-Value 영역)
      2) 경과기간,납입보험료,해약환급금  (해약환급금 표)
      3) 급부명,지급 사유,지급 금액    (지급기준표)
    """
    raw_bytes = file_storage.stream.read()
    file_storage.stream.seek(0)

    # 인코딩 자동 판별
    text = None
    for enc in ("utf-8", "cp949", "euc-kr"):
        try:
            text = raw_bytes.decode(enc)
            break
        except:
            pass
    if text is None:
        text = raw_bytes.decode("utf-8", errors="ignore")

    sample = text[:2000]
    try:
        dialect = _csv.Sniffer().sniff(sample, delimiters=",;\t")
        delim = dialect.delimiter
    except:
        delim = ","

    rdr = _csv.reader(_io.StringIO(text), delimiter=delim)
    rows = [row for row in rdr if any((c or "").strip() for c in row)]

    def _norm(s): return (s or "").strip()
    def _nk(s): return (s or "").strip().lower().replace(" ", "")

    def _to_number(x):
        s = str(x or "").strip().replace(",", "").replace("원", "").replace("₩", "")
        try:
            return float(s) if s else 0.0
        except:
            return 0.0

    def _fmt_money(n):
        f = float(n)
        return f"{int(f):,}" if f.is_integer() else f"{f:,.0f}"

    # 섹션 헤더
    KV_HDR = ("항목", "내용")
    REFUND_HDR = ("경과기간", "납입보험료", "해약환급금")
    CRITERIA_HDR = ("급부명", "지급 사유", "지급 금액")

    section = None
    kv_pairs = []
    refund_rows_raw = []
    criteria_rows_raw = []

    for row in rows:
        cols = [_norm(c) for c in row]
        ncols = [_nk(c) for c in row]

        if len(ncols) >= 2 and ncols[0] == _nk(KV_HDR[0]) and ncols[1] == _nk(KV_HDR[1]):
            section = "kv"; continue
        if len(ncols) >= 3 and ncols[0] == _nk(REFUND_HDR[0]) and ncols[1] == _nk(REFUND_HDR[1]) and ncols[2] == _nk(REFUND_HDR[2]):
            section = "refund"; continue
        if len(ncols) >= 3 and ncols[0] == _nk(CRITERIA_HDR[0]) and ncols[1] == _nk(CRITERIA_HDR[1]) and ncols[2] == _nk(CRITERIA_HDR[2]):
            section = "criteria"; continue

        if section == "kv":
            key = cols[0] if len(cols) >= 1 else ""
            val = cols[1] if len(cols) >= 2 else ""
            if key:
                kv_pairs.append((key, val))
        elif section == "refund":
            if len(cols) >= 3:
                refund_rows_raw.append([cols[0], cols[1], cols[2]])
        elif section == "criteria":
            if len(cols) >= 3:
                # 큰따옴표로 감싼 셀 내 개행 보존됨
                criteria_rows_raw.append([cols[0], cols[1], cols[2]])

    kv = {k: v for k, v in kv_pairs}
    company_name = kv.get("회사명", "").strip()
    product_name = kv.get("상품명", "").strip()
    wishlist_lines = [f"{k}: {v}" if v else k for k, v in kv_pairs]
    wishlist_text = "\n".join(wishlist_lines)

    # 해약환급금 스펙
    refund_rows_out = []
    for r in refund_rows_raw:
        term = str(r[0]).strip()
        a = _to_number(r[1]); b = _to_number(r[2])
        rate = "0.0%" if a == 0 else f"{round(b/a*100, 1)}%"
        refund_rows_out.append([term, _fmt_money(a), _fmt_money(b), rate])

    refund_spec = None
    if refund_rows_out:
        refund_spec = {
            "title": "해약환급금 예시",
            "headers": ["경과기간", "납입보험료 (A)", "해약환급금 (B)", "환급률 (B/A)"],
            "rows": refund_rows_out
        }

    # 지급기준표 스펙
    criteria_rows = []
    for r in criteria_rows_raw:
        criteria_rows.append([r[0], r[1], r[2]])

    criteria_spec = None
    if criteria_rows:
        criteria_spec = {
            "title": "보험금 지급기준표",
            "headers": ["급부명", "지급 사유", "지급 금액"],
            "rows": criteria_rows,
            "merge": []
        }

    return {
        "company_name": company_name,
        "product_name": product_name,
        "wishlist_text": wishlist_text,
        "refund_spec": refund_spec,
        "criteria_spec": criteria_spec
    }

# JSON을 텍스트로 변환
def json_to_text(policy: dict) -> str:
    full_text = []
    if not isinstance(policy, dict):
        return ""

    # Add main title
    if policy.get("title"):
        full_text.append(policy.get("title"))
        full_text.append("") # Add a blank line

    # Process sections and articles
    for section in policy.get("sections", []):
        if section.get("name"):
            full_text.append(section.get("name"))
        
        for article in section.get("articles", []):
            article_parts = []
            if article.get("title"):
                article_parts.append(article.get("title"))
            
            article_parts.extend(article.get("clauses", []))
            
            # Join the parts of a single article with newlines
            full_text.append("\n".join(article_parts))

    # Join all articles with two newlines to create a space between them
    return "\n\n".join(full_text)

# 신규: 멀티파트 업로드 
@app.route('/api/generate', methods=['POST', 'OPTIONS'])
# @cross_origin(origin='*')
def generate_terms_v2():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    if not gemini_model:
        return jsonify({"error": "AI 모델 초기화 실패"}), 500

    if not request.content_type or "multipart/form-data" not in request.content_type:
        return jsonify({"error": "multipart/form-data 로 전송해 주세요."} ), 400

    try:
        form = request.form
        files = request.files

        # 선택 입력(없어도 CSV로 덮어씀)
        company_name = form.get('companyName', '').strip()
        product_name = form.get('productName', '').strip()
        category= form.get('category', '').strip()
        wishlist= form.get('requirements', '').strip()
        effective_date = form.get('effectiveDate', '').strip()
        
        user_id = request.headers.get('x-authenticated-user-uid')

        # user_id는 헤더에서 가져옴
        # effective_date는 현재 테스트에서 사용되지 않으므로 생략

        # 통합 CSV 파싱 (회사명/상품명/위시리스트 텍스트/표 스펙)
        parsed = parse_unified_product_csv_upload(files['productMeta'])
        if parsed["company_name"]:
            company_name = parsed["company_name"]
        if parsed["product_name"]:
            product_name = parsed["product_name"]
        if parsed["wishlist_text"]:
            wishlist = parsed["wishlist_text"]

        # 하드 검증 (테스트용 값으로 대체)
        if not all([company_name, product_name, wishlist, user_id, category]):
            return jsonify({"error": "테스트용 필수 입력값(회사명, 상품명, 상품정보, 사용자ID, 카테고리) 누락"}), 400

        # 포인트 차감
        try:
            deduction_amount = 5000
            reason = urllib.parse.quote("AI 약관 초안 생성")
            point_deduction_url = _build_point_reduce_url(POINT_SERVICE_URL, user_id, deduction_amount, reason)
            logging.info(f"포인트 차감 요청: {point_deduction_url}")
            point_response = requests.post(point_deduction_url)
            if not point_response.ok:
                error_message = "포인트가 부족합니다."
                try:
                    error_data = point_response.json()
                    if "error" in error_data:
                        error_message = error_data["error"]
                except requests.exceptions.JSONDecodeError:
                    error_message = point_response.text or error_message
                return jsonify({"error": error_message}), 400
        except requests.exceptions.RequestException:
            logging.exception("Point 서비스 호출 실패")
            return jsonify({"error": "포인트 서비스에 연결할 수 없습니다."} ), 500

        
        if not category:
            return jsonify({"error": "category가 필요합니다."}), 400
        persist_dir = VECTOR_DB_MAP.get(category)
        if not persist_dir or not os.path.isdir(persist_dir):
            return jsonify({"error": f"'{category}' 벡터 저장소를 찾을 수 없습니다."}), 400
        vectorstore = Chroma(persist_directory=persist_dir, embedding_function=embedding)
        retriever = vectorstore.as_retriever(search_kwargs={'k': 5})

        # docs = retriever.invoke(wishlist)
        # context = "\n\n".join([d.page_content for d in docs])[:12000]
        
        # logging.info(f"DB 검색어: '{retrieval_query}'")
        # docs = retriever.invoke(retrieval_query)
        # retrieval_query = product_name

        # 두  벡터db 임시 쿼리로 상품명
        logging.info(f"초안카테고리DB 검색어: '{product_name}'")
        try:
            docs = retriever.invoke(product_name)
        except Exception as e:
            logging.error(f"초안카테고리DB 검색 실패: {e}")
            return jsonify({"error": "초안카테고리DB 검색 중 오류가 발생했습니다."}), 500
        
        logging.info(f"법령DB 검색어: '{product_name}'")
        try:
            law_docs = retriever.invoke(product_name)
        except Exception as e:
            logging.error(f"법령DB 검색 실패: {e}")
            return jsonify({"error": "법령DB 검색 중 오류가 발생했습니다."}), 500
        
        
        
        # AI에게 전달할 참고문서(context)는 검색 결과로 만듭니다.
        context = "\n\n".join([d.page_content for d in docs])
        context = "\n\n".join([d.page_content for d in law_docs])
        

        # 표 스펙 구성(통합 CSV에서)
        parsed = parse_unified_product_csv_upload(files['productMeta'])

        user_tables = {}
        if parsed["refund_spec"]:
            user_tables["해약환급금"] = parsed["refund_spec"]
            user_tables["해약환급금예시"] = parsed["refund_spec"]  # 동일 스펙 재사용
        if parsed["criteria_spec"]:
            user_tables["지급기준표"] = parsed["criteria_spec"]

        # JSON 약관 생성
        prompt = PROMPT_TEMPLATE_JSON.format(
            company_name=company_name,
            product_name=product_name,
            wishlist=wishlist,
            context=context
        )
        raw = _gen_with_gemini(prompt)
        policy = _parse_json_loose(raw)

        # tables 기본값 보정(LLM이 비워둘 때만)
        if not isinstance(policy.get("tables"), list) or not policy["tables"]:
            fallback_tables = []
            if "해약환급금" in user_tables:
                fallback_tables.append("해약환급금")
            if "지급기준표" in user_tables:
                fallback_tables.append("지급기준표")
            policy["tables"] = fallback_tables

        

        # JSON을 텍스트로 변환하여 반환
        policy_text = json_to_text(policy)
        return jsonify({
            "policy": policy_text,
            "meta": {
                "companyName": company_name,
                "productName": product_name,
                "category": category,
                "effectiveDate": effective_date,
            }
        })

        

    except Exception:
        logging.exception("약관 생성 중 오류")
        return jsonify({"error": "약관 생성 중 서버에서 오류가 발생했습니다."} ), 500


# Health check
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "ai_initialized": gemini_model is not None}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)), debug=True)