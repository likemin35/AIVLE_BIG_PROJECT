# -*- coding: utf-8 -*-
"""
service_ner.py (LAW_REF 제거 + CONDITION 자동 확장 + CONDITION ≤5자 제거)
- 조항 분리
- Gemini NER (text/label)
- start/end 오프셋 계산
- displacy HTML 생성
- CORS/프리플라이트(OPTIONS) 안정 처리
"""

import os, re, json, logging, unicodedata
from string import Template
from flask import Flask, request, jsonify
from flask_cors import CORS
import vertexai
from google.oauth2 import service_account
from google.cloud import secretmanager
from langchain_google_vertexai import ChatVertexAI
import spacy
from spacy import displacy

# -------------------------
# Flask & CORS
# -------------------------
app = Flask(__name__)
CORS(app,
     resources={r"/api/*": {"origins": "*"}},
     supports_credentials=False,
     allow_headers=["Content-Type"],
     methods=["GET", "POST", "OPTIONS"])

logger = logging.getLogger("service_ner")
logging.basicConfig(level=logging.INFO)

# 모든 /api/* OPTIONS는 204
@app.route("/api/<path:_any>", methods=["OPTIONS"])
def any_options(_any):
    return ("", 204)

# -------------------------
# Vertex AI (Secret Manager → 파일 fallback)
# -------------------------
PROJECT_ID = os.getenv("GCP_PROJECT", "aivle-team0721")
LOCATION   = os.getenv("GCP_LOCATION", "us-central1")
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
LOCAL_KEY_FILE = os.environ.get(
    "GOOGLE_APPLICATION_CREDENTIALS",
    os.path.join(BASE_DIR, "the-method-467402-k4-3b6511ed1f9e.json")
)

credentials = None
try:
    sm = secretmanager.SecretManagerServiceClient()
    secret_name = f"projects/{PROJECT_ID}/secrets/firebase-adminsdk/versions/latest"
    payload = sm.access_secret_version(name=secret_name).payload.data.decode("utf-8")
    credentials = service_account.Credentials.from_service_account_info(json.loads(payload))
    logger.info("Secret Manager 자격증명 로드 성공")
except Exception as e:
    logger.warning(f"Secret Manager 실패: {e} / 로컬 키 사용 시도")
    if os.path.exists(LOCAL_KEY_FILE):
        credentials = service_account.Credentials.from_service_account_file(LOCAL_KEY_FILE)
        logger.info("로컬 서비스 계정 키 로드 성공")
    else:
        logger.error("자격증명 없음. LLM 호출 불가")

gemini = None
if credentials:
    try:
        vertexai.init(project=PROJECT_ID, location=LOCATION, credentials=credentials)
        gemini = ChatVertexAI(
            model_name="gemini-2.5-flash-lite",
            location=LOCATION,
            response_mime_type="application/json",
            temperature=0
        )
        logger.info("Gemini 초기화 성공")
    except Exception as e:
        logger.error(f"Gemini 초기화 실패: {e}")

# -------------------------
# spaCy (시각화용 빈 모델)
# -------------------------
nlp = spacy.blank("en")

# LAW_REF 제거: 색상에서도 삭제
VIS_COLORS = {
    "CLAUSE_ID": "#ffe6e6",
    "CLAUSE_REF": "#e6f0ff",
    "CONDITION": "#ffe6f7",
    "ORGANIZATION": "#f0e6ff",
    "TIME_DURATION": "#fff0e6"
}

# 허용 라벨 화이트리스트 (LAW_REF 없음)
ALLOWED_LABELS = {"CLAUSE_ID", "CLAUSE_REF", "CONDITION", "ORGANIZATION", "TIME_DURATION"}

# -------------------------
# 유틸
# -------------------------
def extract_text_field(data):
    t = data.get("text", "")
    if isinstance(t, dict):
        t = t.get("value", json.dumps(t, ensure_ascii=False))
    if not isinstance(t, str):
        t = str(t or "")
    return t

def nfc(s): return unicodedata.normalize("NFC", s or "")

# -------------------------
# 조항 분리
# -------------------------
HEADER_RE = re.compile(
    r'(?<=\n)\s*(?:\*\*\s*)?(?P<header>제\s*\d+\s*조(?:\s*[（(][^)\n）]*[）)])?)\s*(?:\*\*)?\s*(?=\n)'
)

def split_clauses(raw: str):
    if not raw:
        return []
    t = raw.replace("\r\n", "\n").replace("\r", "\n")
    if not t.startswith("\n"): t = "\n" + t
    if not t.endswith("\n"):  t = t + "\n"

    m = list(HEADER_RE.finditer(t))
    out = []
    if not m:
        if raw.strip():
            out.append({"clause_id": "전체", "korean": raw.strip()})
        return out

    if m[0].start() > 0:
        pre = t[:m[0].start()].strip()
        if pre:
            out.append({"clause_id": "머리말", "korean": pre})

    for i, mm in enumerate(m):
        cid = mm.group("header").strip()
        start = mm.start()
        end = m[i + 1].start() if i + 1 < len(m) else len(t)
        body = re.sub(r"\*+", "", t[start:end].strip())
        out.append({"clause_id": cid, "korean": body})
    return out

def canon_clause_id(s: str):
    m = re.search(r'제\s*(\d+)\s*조', s or "")
    return f"제{int(m.group(1))}조" if m else None

# -------------------------
# NER 프롬프트 (CONDITION 끝-토큰 강제)
# -------------------------
NER_PROMPT = Template(r"""
당신은 한국어 보험약관 조항에서 엔티티를 추출하는 시스템입니다. 결과는 **JSON만** 반환하세요. 코드블록/설명 금지.

[라벨]
- CLAUSE_ID: 헤더의 조항 번호("제13조"). **문서의 첫 줄(괄호 속 제목 포함)에서는 이 라벨 1개만**.
- CLAUSE_REF: 본문에서 참조하는 다른 조항 번호("제10조" 등). 자기 자신은 제외.
- ORGANIZATION: 회사, 계약자, 환자, 피보험자, 의료기관, 의사, 전문의, 제3자 등 주체/기관.
- TIME_DURATION: 30일 이내, 즉시, 2025년 8월 9일 등 기간/시한/날짜/기한.
- CONDITION: 조건/사유/면책 트리거 **문장 단위 절**.

[CONDITION 끝-토큰 규칙(필수)]
- CONDITION은 반드시 다음 패턴 중 하나로 **끝나야 한다**:
  "경우", "경우에", "경우에는", "경우에도", "경우엔", "경우라면", "경우로", "경우로서", "경우에만",
  "때", "때에", "때에는", "때엔", "시", "시에", "시에는", "시엔"
- 위 끝-토큰에 붙은 조사/어미까지 **포함**해야 한다(예: "경우에는", "때에는", "시에도").
- 쉼표/마침표 앞에서 끊기지 않도록, **같은 문장 안에서** 끝-토큰까지 확장한다.
- "…을/를/의 의미이다", "…을 말한다" 같은 **정의/설명**은 CONDITION에 포함하지 않는다.
- 같은 문장 안에 조건이 여러 개이고 각자 끝-토큰이 있으면 **각각 별도 CONDITION**으로 추출한다.
- 끝-토큰이 없는 부분문장/구는 CONDITION으로 추출하지 않는다.

[출력 규칙]
- 엔티티 텍스트는 **입력 원문에서 그대로 복사**(띄어쓰기/맞춤법 보존). 겹치거나 중복되는 엔티티는 더 긴 하나만 남김.
- 헤더 줄에서는 CLAUSE_ID 외 라벨을 추출하지 말 것.
- 출력은 **JSON 배열 1개**이며 그 배열 안에 **객체 1개**만 존재:
  [
    {
      "text": "<입력 원문 그대로>",
      "entities": [
        {"text":"...","label":"..."}
      ]
    }
  ]

[자기검증 체크리스트]
- 모든 CONDITION이 지정된 끝-토큰으로 끝나는가? 아니면 **같은 문장 안에서** 끝-토큰까지 확장하라.
- CONDITION이 쉼표/마침표 앞에서 끊기지 않았는가?
- 중복/부분중복 엔티티는 제거했는가?
- 출력은 오직 JSON 배열 1개인가?

입력 조항 원문:
$clause
""")

# -------------------------
# CONDITION 자동 확장 & 길이 필터
# -------------------------
RE_COND_END_TOKEN = re.compile(
    r'(?:경우(?:에(?:는|도)?|엔|라면|로서|로|에만)?|'
    r'때(?:에(?:는)?|엔)?|'
    r'시(?:에(?:는)?|엔)?)$'
)

def _cond_ends_ok(s: str) -> bool:
    return bool(RE_COND_END_TOKEN.search((s or '').strip()))

def _is_short_condition(s: str) -> bool:
    """CONDITION 길이가 5자 이하(공백 제외)이면 True"""
    return len(re.sub(r'\s+', '', (s or '').strip())) <= 5

def expand_condition_to_end_token(full_text: str, cond_text: str) -> str:
    """CONDITION이 '경우/때/시(+조사)'로 안 끝나면 같은 문장 안에서 그 토큰까지 확장"""
    if not cond_text:
        return cond_text
    if _cond_ends_ok(cond_text):
        return cond_text

    T = nfc(full_text)
    C = nfc((cond_text or "").strip())

    i = T.find(C)
    if i == -1:
        return cond_text
    j = i + len(C)

    # 같은 문장 경계까지만 탐색
    sentence_tail = T[j:]
    stop = re.search(r'[.\n;!?？！]', sentence_tail)
    search_zone = sentence_tail[: stop.start() if stop else len(sentence_tail)]

    m = re.search(
        r'(?:경우(?:에(?:는|도)?|엔|라면|로서|로|에만)?|때(?:에(?:는)?|엔)?|시(?:에(?:는)?|엔)?)',
        search_zone
    )
    if not m:
        return cond_text
    end_pos = j + m.end()
    return T[i:end_pos].strip()

# -------------------------
# Gemini 호출
# -------------------------
def call_gemini_entities(clause_text: str):
    if not gemini:
        raise RuntimeError("Gemini가 초기화되지 않았습니다.")
    prompt = NER_PROMPT.safe_substitute(clause=clause_text)
    resp = gemini.invoke(prompt)
    c = (resp.content or "").strip()

    # 코드블록 처리
    if "```json" in c:
        c = c.split("```json", 1)[1].split("```", 1)[0].strip()

    # JSON 추출
    l, r = c.find("["), c.rfind("]")
    entities = []
    if l != -1 and r != -1 and r >= l:
        try:
            arr = json.loads(c[l:r+1])
            if isinstance(arr, dict):
                arr = [arr]
            obj = arr[0] if arr else {}
            raw = [{"text": e.get("text",""), "label": e.get("label","")} for e in obj.get("entities", [])]
            for e in raw:
                lbl = e.get("label")
                txt = e.get("text", "")
                if not txt or lbl not in ALLOWED_LABELS:
                    continue
                if lbl == "CONDITION":
                    txt = expand_condition_to_end_token(clause_text, txt)
                    if _is_short_condition(txt):
                        continue
                entities.append({"text": txt, "label": lbl})
        except Exception:
            entities = []
    return {"text": clause_text, "entities": entities}

# -------------------------
# 오프셋 계산
# -------------------------
def canon_clause_pat_from_text(s: str):
    m = re.search(r'제\s*(\d+)\s*조', s or "")
    return re.compile(rf'제\s*{int(m.group(1))}\s*조') if m else None

def make_flex_regex(s: str):
    parts = re.split(r"\s+", (s or "").strip())
    return re.compile(r"\s*".join(map(re.escape, parts)))

def find_offsets(text: str, ent_text: str, label: str):
    text, ent_text = nfc(text), nfc(ent_text)
    if not ent_text:
        return []
    # 정확 문자열
    spans = [(m.start(), m.end()) for m in re.finditer(re.escape(ent_text), text)]
    if spans:
        return spans
    # CLAUSE_ID/REF: 숫자 유연 패턴
    if label in ("CLAUSE_ID", "CLAUSE_REF"):
        p = canon_clause_pat_from_text(ent_text)
        if p:
            spans = [(m.start(), m.end()) for m in p.finditer(text)]
            if spans:
                return sorted(set(spans))
    # 공백/개행 흡수 유연 매치
    for m in make_flex_regex(ent_text).finditer(text):
        spans.append((m.start(), m.end()))
    return sorted(set(spans))

POLICY = {
    "CLAUSE_ID": "first_only",
    "CLAUSE_REF": "keep_all",
    "ORGANIZATION": "keep_all",
    "TIME_DURATION": "keep_all",
    "CONDITION": "keep_all",
}

def apply_policy(spans, label):
    if not spans: return []
    mode = POLICY.get(label, "first_only")
    if mode == "keep_all":
        spans = sorted(spans)
        out, last = [], -1
        for s, e in spans:
            if s >= last:
                out.append((s, e))
                last = e
        return out
    return [sorted(spans)[0]]

def ensure_clause_id_entity(text, entities):
    entities = entities or []
    if any(e.get("label") == "CLAUSE_ID" for e in entities):
        return entities
    first = (text.splitlines() or [""])[0]
    m = re.search(r'제\s*(\d+)\s*조', first)
    if m:
        clause_id = f"제{int(m.group(1))}조"
        return [{"text": clause_id, "label": "CLAUSE_ID"}] + entities
    return entities

# -------------------------
# 규칙 보정(LLM 누락분 보강) — LAW_REF 규칙 없음
# -------------------------
KOREAN_BOUND = r'(?<![가-힣A-Za-z0-9]){}(?![가-힣A-Za-z0-9])'
ORG_WORDS = ["회사","계약자","환자","피보험자","의료기관","의사","전문의","제3자","제 3자"]

RE_CLAUSE_REF = re.compile(r'제\s*\d+\s*조')

# CONDITION 보강용: ‘경우/때/시’로 끝나는 절만
RE_COND_ENDS = re.compile(
    r'(?:[^.\n]*?(?:하는|한|하지\s*않는|않을|인|로\s*인한|에\s*의한|에\s*따른|에\s*따라)[^.\n]*?'
    r'(?:경우(?:에(?:는|도)?|엔|라면|로서|로|에만)?|때(?:에(?:는)?|엔)?|시(?:에(?:는)?|엔)?))'
)

RE_TIME = re.compile(
    r'(?:\d{4}\.\d{1,2}\.\d{1,2}|\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일|'
    r'\d+\s*(?:영업)?일\s*(?:이내|이상|이하)?|\d+\s*(?:개월|달|월|년|시간|분)\s*(?:이내|이상|이하)?|'
    r'지체\s*없이|즉시)'
)

def filter_non_id_in_header(text, entities):
    if not text: return entities
    header = text.splitlines()[0]
    out = []
    for e in entities or []:
        if e.get("label") != "CLAUSE_ID" and e.get("text","") and e["text"] in header:
            continue
        out.append(e)
    return out

def augment_entities_with_rules(text, entities, self_clause_id=None):
    base = entities[:] if entities else []

    def _k(lbl, t): return (lbl, re.sub(r'\s+', ' ', (t or '').strip()))
    seen = set(_k(e.get("label"), e.get("text")) for e in base if e.get("text"))

    body = "\n".join(text.splitlines()[1:]) if "\n" in text else text  # 헤더 제외

    # CLAUSE_REF (자기 자신 제외)
    for m in RE_CLAUSE_REF.finditer(body):
        t = m.group(0)
        if self_clause_id and t.replace(" ", "") == (self_clause_id or "").replace(" ", ""):
            continue
        if _k("CLAUSE_REF", t) not in seen:
            base.append({"text": t, "label": "CLAUSE_REF"}); seen.add(_k("CLAUSE_REF", t))

    # TIME_DURATION
    for m in RE_TIME.finditer(body):
        t = m.group(0)
        if _k("TIME_DURATION", t) not in seen:
            base.append({"text": t, "label": "TIME_DURATION"}); seen.add(_k("TIME_DURATION", t))

    # ORGANIZATION
    for w in ORG_WORDS:
        p = re.compile(KOREAN_BOUND.format(re.escape(w)))
        for m in p.finditer(body):
            t = m.group(0)
            if _k("ORGANIZATION", t) not in seen:
                base.append({"text": t, "label": "ORGANIZATION"}); seen.add(_k("ORGANIZATION", t))

    # CONDITION – LLM이 이미 하나라도 있으면 규칙 보강 추가하지 않음
    have_llm_condition = any(e.get("label") == "CONDITION" for e in base)
    if not have_llm_condition:
        for m in RE_COND_ENDS.finditer(body):
            t = expand_condition_to_end_token(body, m.group(0).strip())
            if _is_short_condition(t):
                continue
            if _k("CONDITION", t) not in seen:
                base.append({"text": t, "label": "CONDITION"}); seen.add(_k("CONDITION", t))

    return base

# -------------------------
# displacy HTML
# -------------------------
def to_displacy_html(items):
    options = {"colors": VIS_COLORS}
    blocks = []
    for it in items:
        text = it.get("text", "")
        ents = it.get("entities", [])
        if not ents:
            continue
        doc = nlp.make_doc(text)
        spans = []
        for e in ents:
            span = doc.char_span(e["start"], e["end"], label=e["label"], alignment_mode="contract")
            if span is not None:
                spans.append(span)
        if not spans:
            continue
        doc.ents = spacy.util.filter_spans(spans)
        html = displacy.render(doc, style="ent", options=options)
        header = text.splitlines()[0].strip()
        blocks.append(
            f"<hr style='margin:24px 0;border:1px solid #ddd'>"
            f"<h3 style='margin:0 0 8px 0'>{header}</h3>{html}"
        )
    if not blocks:
        return "<html><head><meta charset='utf-8'></head><body><p>표시할 엔티티가 없습니다.</p></body></html>"
    return "<html><head><meta charset='utf-8'></head><body>" + "\n".join(blocks) + "</body></html>"

# -------------------------
# Routes
# -------------------------
@app.route("/api/health", methods=["GET", "OPTIONS"])
def api_health():
    if request.method == "OPTIONS":
        return ("", 204)
    return jsonify({"ok": True, "service": "service_ner"})

@app.route("/api/routes", methods=["GET", "OPTIONS"])
def api_routes():
    if request.method == "OPTIONS":
        return ("", 204)
    rules = sorted([str(r.rule) for r in app.url_map.iter_rules()])
    return jsonify({"routes": rules})

@app.route("/api/debug/echo", methods=["POST", "OPTIONS"])
def api_debug_echo():
    if request.method == "OPTIONS":
        return ("", 204)
    data = request.get_json(silent=True) or {}
    return jsonify({"ok": True, "data": data})

@app.route("/api/clauses/split", methods=["POST", "OPTIONS"])
def api_split():
    if request.method == "OPTIONS":
        return ("", 204)
    data = request.get_json(silent=True) or {}
    text = extract_text_field(data)
    return jsonify({"clauses": split_clauses(text)})

@app.route("/api/ner", methods=["POST", "OPTIONS"])
def api_ner():
    if request.method == "OPTIONS":
        return ("", 204)
    data = request.get_json(silent=True) or {}
    text = extract_text_field(data)

    clauses = split_clauses(text)
    items = []
    for c in clauses:
        ner = call_gemini_entities(c["korean"])
        ents0 = ensure_clause_id_entity(ner["text"], ner.get("entities"))
        ents0 = filter_non_id_in_header(ner["text"], ents0)
        cid = canon_clause_id((ner["text"].splitlines() or [""])[0])
        ner["entities"] = augment_entities_with_rules(ner["text"], ents0, self_clause_id=cid)
        items.append(ner)
    return jsonify({"items": items})

@app.route("/api/ner/offsets", methods=["POST", "OPTIONS"])
def api_offsets():
    if request.method == "OPTIONS":
        return ("", 204)
    data = request.get_json(silent=True) or {}
    items_in = data.get("items", [])

    items_out = []
    for it in items_in:
        text = it.get("text","")
        ents_in = ensure_clause_id_entity(text, it.get("entities", []))
        ents_in = filter_non_id_in_header(text, ents_in)
        cid = canon_clause_id((text.splitlines() or [""])[0])
        ents_in = augment_entities_with_rules(text, ents_in, self_clause_id=cid)

        ents_out, seen = [], set()
        for e in ents_in:
            for s, epos in apply_policy(find_offsets(text, e["text"], e["label"]), e["label"]):
                k = (e["label"], s, epos)
                if k in seen:
                    continue
                seen.add(k)
                ents_out.append({"text": text[s:epos], "label": e["label"], "start": s, "end": epos})
        items_out.append({"text": text, "entities": ents_out})
    return jsonify({"items": items_out})

@app.route("/api/visualize", methods=["POST", "OPTIONS"])
def api_visualize():
    if request.method == "OPTIONS":
        return ("", 204)
    if not gemini:
        return jsonify({"error": "Gemini가 초기화되지 않았습니다."}), 500

    data = request.get_json(silent=True) or {}
    raw_text = extract_text_field(data)

    clauses = split_clauses(raw_text)
    offset_items = []
    for c in clauses:
        ner = call_gemini_entities(c["korean"])
        ents0 = ensure_clause_id_entity(ner["text"], ner.get("entities"))
        ents0 = filter_non_id_in_header(ner["text"], ents0)
        cid = canon_clause_id((ner["text"].splitlines() or [""])[0])
        ents0 = augment_entities_with_rules(ner["text"], ents0, self_clause_id=cid)

        text = ner["text"]
        ents, seen = [], set()
        for e in ents0:
            for s, epos in apply_policy(find_offsets(text, e["text"], e["label"]), e["label"]):
                k = (e["label"], s, epos)
                if k in seen:
                    continue
                seen.add(k)
                ents.append({"text": text[s:epos], "label": e["label"], "start": s, "end": epos})
        if ents:
            offset_items.append({"text": text, "entities": ents})

    html = to_displacy_html(offset_items)
    return jsonify({"html": html, "items": offset_items})

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8081"))
    logger.info(f">>> service_ner STARTED from {__file__}")
    app.run(host="0.0.0.0", port=port, debug=True)
