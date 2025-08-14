# -*- coding: utf-8 -*-
"""
service_graph.py
- NER 마이크로서비스(8081) 결과를 받아 조항별 연관도 그래프(HTML) 생성
- CLAUSE 노드 hover 시: 조항 '본문 전체' 텍스트(줄바꿈 유지, HTML 표시 X)
- 우측 상단 Legend 표시
- 개선:
  (1) CLAUSE 크기 = 라벨별 TF-IDF + PageRank -> value 스케일링 (vis-network scaling 사용)
  (2) CLAUSE만 라벨 표시(큰 점), (3) CLAUSE 외 노드는 글자 숨기고 hover 툴팁만
"""

import os, re, json, logging, math
from collections import Counter, defaultdict
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import networkx as nx
from pyvis.network import Network

# -----------------------
# Flask / CORS
# -----------------------
app = Flask(__name__)
CORS(app,
     resources={r"/api/*": {"origins": "*"}},
     supports_credentials=False,
     allow_headers=["Content-Type"],
     methods=["GET", "POST", "OPTIONS"])

logger = logging.getLogger("service_graph")
logging.basicConfig(level=logging.INFO)

NER_BASE_URL = os.getenv("NER_BASE_URL", "http://localhost:8081")
PORT = int(os.getenv("PORT", "8082"))

# -----------------------
# 텍스트/HTML 유틸
# -----------------------
_HTML_ESCAPE_MAP = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}
def html_escape(s: str) -> str:
    return "".join(_HTML_ESCAPE_MAP.get(ch, ch) for ch in (s or ""))

def clean_text_for_tooltip(s: str) -> str:
    """<br>는 줄바꿈으로, 그 외 태그 제거 후 escape → HTML 그대로 보이지 않게"""
    if not s: return ""
    t = re.sub(r"(?i)<br\s*/?>", "\n", s)
    t = re.sub(r"<[^>\n]+>", "", t)
    return html_escape(t)

def extract_text_field(data):
    t = data.get("text", "")
    if isinstance(t, dict):
        t = t.get("value", json.dumps(t, ensure_ascii=False))
    if not isinstance(t, str):
        t = str(t or "")
    return t

def canon_clause_id(s: str):
    m = re.search(r'제\s*(\d+)\s*조', s or "")
    return f"제{int(m.group(1))}조" if m else None

def header_of_clause(text: str):
    return (text.splitlines() or [""])[0].strip()

def body_of_clause(text: str):
    lines = text.splitlines()
    return "\n".join(lines[1:]).strip() if len(lines) > 1 else ""

def clause_tooltip_text(cid: str, full_text: str) -> str:
    header = header_of_clause(full_text) or cid
    body = body_of_clause(full_text) or full_text
    if body:
        return clean_text_for_tooltip(f"{header}\n{body}")
    return clean_text_for_tooltip(header)

# -----------------------
# 색상
# -----------------------
NODE_COLORS = {
    "CLAUSE": "#4f46e5",       # 진한 인디고 (점이 커져도 식별 용이)
    "CLAUSE_REF": "#60a5fa",
    "ORGANIZATION": "#8b5cf6",
    "TIME_DURATION": "#10b981",
    "CONDITION": "#ef4444",
}

# -----------------------
# NER 호출
# -----------------------
def call_ner_visualize(text: str):
    url = f"{NER_BASE_URL}/api/visualize"
    resp = requests.post(url, json={"text": text}, timeout=120)
    resp.raise_for_status()
    j = resp.json()
    return j.get("items", []), j.get("html", "")

# -----------------------
# TF-IDF + PageRank 기반 크기 산정
# -----------------------
ENT_FOR_TFIDF = {"ORGANIZATION", "TIME_DURATION", "CONDITION"}  # CLAUSE_REF 제외
TFIDF_LABEL_WEIGHTS = {
    "ORGANIZATION": 1.00,
    "TIME_DURATION": 0.90,
    "CONDITION": 1.15,  # 조건/면책 가중치
}

def _minmax_norm(values_by_key: dict, eps: float = 1e-12):
    if not values_by_key:
        return {}
    vs = list(values_by_key.values())
    vmin, vmax = min(vs), max(vs)
    if abs(vmax - vmin) < eps:
        return {k: 0.0 for k in values_by_key}
    return {k: (v - vmin) / (vmax - vmin) for k, v in values_by_key.items()}

def _compute_clause_tfidf(clause_entities: dict) -> dict:
    """
    clause_entities: { cid: Counter({ (label, entity_text): tf, ... }), ... }
    반환: {cid: tfidf_sum}
    """
    # df: (label, text) 단위
    df = Counter()
    for cid, counter in clause_entities.items():
        for le in counter.keys():
            df[le] += 1
    N = max(1, len(clause_entities))
    idf = {le: math.log(N / df[le]) if df[le] > 0 else 0.0 for le in df}

    tfidf_sum = {}
    for cid, counter in clause_entities.items():
        s = 0.0
        for (label, etext), tf in counter.items():
            w = TFIDF_LABEL_WEIGHTS.get(label, 1.0)
            s += (tf * idf.get((label, etext), 0.0)) * w
        tfidf_sum[cid] = s
    return tfidf_sum

# -----------------------
# 그래프 구성
# -----------------------
def build_graph_from_items(items):
    G = nx.DiGraph()
    nodes, edges = [], []

    # 조항 텍스트 맵
    clause_text_map = {}
    for it in items:
        txt = it.get("text", "")
        header = header_of_clause(txt)
        cid = canon_clause_id(header) or header
        clause_text_map[cid] = txt

    # 조항 노드 (shape=dot, 라벨 표시)
    clause_nodes = {}
    for cid, full_text in clause_text_map.items():
        nid = f"CLAUSE::{cid}"
        clause_nodes[cid] = nid
        if not G.has_node(nid):
            G.add_node(
                nid,
                label=cid,  # CLAUSE만 라벨 표시
                title=clause_tooltip_text(cid, full_text),
                color=NODE_COLORS["CLAUSE"],
                shape="dot",        # ✅ value/size가 적용되는 도트
                type="CLAUSE",
                font={"size": 14}
            )
            nodes.append({"id": nid, "label": cid, "type": "CLAUSE"})

    # 엔티티 연결 수집 + 엣지 구성
    clause_entity_counts = defaultdict(Counter)  # {cid: Counter({(label, text): tf})}
    for it in items:
        text = it.get("text", "")
        header = header_of_clause(text)
        src_cid = canon_clause_id(header) or header
        src_id = clause_nodes[src_cid]

        for e in it.get("entities", []):
            label = e.get("label")
            etext_raw = (e.get("text") or "").strip()
            if not etext_raw or not label:
                continue
            if label == "CLAUSE_ID":
                continue

            etext = etext_raw

            if label == "CLAUSE_REF":
                # 조항 간 참조 (shape=dot)
                dst_cid = canon_clause_id(etext) or etext
                if dst_cid not in clause_nodes:
                    nid = f"CLAUSE::{dst_cid}"
                    clause_nodes[dst_cid] = nid
                    tip = clause_tooltip_text(dst_cid, clause_text_map.get(dst_cid, dst_cid))
                    G.add_node(nid, label=dst_cid, title=tip,
                               color=NODE_COLORS["CLAUSE_REF"], shape="dot", type="CLAUSE",
                               font={"size": 14})
                    nodes.append({"id": nid, "label": dst_cid, "type": "CLAUSE"})
                dst_id = clause_nodes[dst_cid]
                if not G.has_edge(src_id, dst_id):
                    G.add_edge(src_id, dst_id, color=NODE_COLORS["CLAUSE_REF"])
                    edges.append({"from": src_id, "to": dst_id, "type": "REF"})
            else:
                # 일반 엔티티: 라벨 완전 숨김 (줌인해도 안 보이게)
                ent_id = f"{label}::{etext}"
                if not G.has_node(ent_id):
                    G.add_node(
                        ent_id,
                        label="",                 # UI 비표시
                        font={"size": 0},         # 라벨 렌더 자체 차단
                        title=f"{label} | {clean_text_for_tooltip(etext)}",  # hover에서만 노출
                        color=NODE_COLORS.get(label, "#9ca3af"),
                        shape="dot",
                        type=label
                    )
                    nodes.append({"id": ent_id, "label": "", "type": label})
                if not G.has_edge(src_id, ent_id):
                    G.add_edge(src_id, ent_id, color=NODE_COLORS.get(label, "#9ca3af"))
                    edges.append({"from": src_id, "to": ent_id, "type": label})

                if label in ENT_FOR_TFIDF:
                    # (label, text) 단위로 TF 축적
                    clause_entity_counts[src_cid][(label, etext)] += 1

    # ---- CLAUSE 크기: 라벨별 TF-IDF + PageRank -> value 사용 ----
    tfidf_sum = _compute_clause_tfidf(clause_entity_counts)
    tfidf_norm = _minmax_norm(tfidf_sum)

    try:
        pr_all = nx.pagerank(G, alpha=0.85)
    except Exception:
        pr_all = {nid: 0.0 for nid in G.nodes()}
    pr_clause = {cid: pr_all.get(node_id, 0.0) for cid, node_id in clause_nodes.items()}
    pr_norm = _minmax_norm(pr_clause)

    # 0~1 점수를 1~100 값으로 변환 -> vis nodes.scaling(min/max)에 의해 픽셀 크기로 매핑
    for cid, node_id in clause_nodes.items():
        s = 0.6 * tfidf_norm.get(cid, 0.0) + 0.4 * pr_norm.get(cid, 0.0)
        s = math.sqrt(max(s, 0.0))          # 상위가 더 커지도록
        value = 1 + int(round(99 * s))      # 1~100
        # 혹시 size가 남아 있으면 제거(충돌 방지)
        if "size" in G.nodes[node_id]:
            G.nodes[node_id].pop("size", None)
        G.nodes[node_id]["value"] = value

    # 엔티티는 매우 작게 고정
    for n in G.nodes():
        if G.nodes[n].get("type") != "CLAUSE":
            if "size" in G.nodes[n]:
                G.nodes[n].pop("size", None)
            G.nodes[n]["value"] = 1

    return G, nodes, edges

# -----------------------
# Legend 스타일 & HTML
# -----------------------
def _legend_css() -> str:
    return """
    <style>
      .vis-tooltip{
        white-space: pre-wrap !important;
        max-width: 920px;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
        line-height: 1.45;
        font-size: 13px;
      }
      .legend{
        position: fixed; right: 12px; top: 12px;
        background: rgba(255,255,255,0.95);
        border: 1px solid #e5e7eb; border-radius: 12px;
        padding: 10px 12px; font-size: 13px;
        box-shadow: 0 2px 12px rgba(0,0,0,.08); z-index: 9999;
      }
      .legend h4{ margin: 0 0 6px; font-size: 13px; font-weight: 700; }
      .legend .item{ display:flex; align-items:center; gap:8px; margin:4px 0; white-space:nowrap; }
      .legend .swatch{ width:12px; height:12px; border-radius:3px; border:1px solid rgba(0,0,0,.2); flex:0 0 12px; }
      .legend .foot{ margin-top:6px; color:#6b7280; font-size:12px; }
    </style>
    """

def _legend_html() -> str:
    items = [
        ("조항 (CLAUSE)", NODE_COLORS["CLAUSE"]),
        ("조항 참조 (CLAUSE_REF)", NODE_COLORS["CLAUSE_REF"]),
        ("주체/조직 (ORGANIZATION)", NODE_COLORS["ORGANIZATION"]),
        ("기간/시점 (TIME_DURATION)", NODE_COLORS["TIME_DURATION"]),
        ("조건/면책/예외 (CONDITION)", NODE_COLORS["CONDITION"]),
    ]
    li = "\n".join([f'<div class="item"><span class="swatch" style="background:{c}"></span>{t}</div>' for t, c in items])
    foot = '<div class="foot">* CLAUSE 노드 크기 = TF-IDF + PageRank (value 기반)</div>'
    return f'<div class="legend"><h4>Legend</h4>{li}{foot}</div>'

# -----------------------
# HTML 생성
# -----------------------
def graph_to_html(G: nx.DiGraph, height="780px", physics=True):
    net = Network(height=height, width="100%", directed=True, notebook=False, cdn_resources="in_line")
    net.toggle_physics(physics)
    net.from_nx(G)

    # ✅ set_options는 JSON 문자열만 허용
    # nodes.scaling.min/max를 크게 설정 → value(1~100)가 픽셀 크기로 매핑됨
    options = {
        "nodes": {
            "shape": "dot",
            "scaling": {"min": 12, "max": 90},   # ← 크기 차이를 이 범위로 시각화
            "font": {"size": 14, "face": "Noto Sans KR"},
            "shadow": True
        },
        "edges": {
            "arrows": {"to": {"enabled": True, "scaleFactor": 0.8}},
            "smooth": {"type": "dynamic"},
            "color": {"opacity": 0.6}
        },
        "physics": {
            "solver": "forceAtlas2Based",
            "forceAtlas2Based": {
                "gravitationalConstant": -50,
                "centralGravity": 0.01,
                "springLength": 150,
                "springConstant": 0.08,
                "avoidOverlap": 0.6
            },
            "stabilization": {"iterations": 250}
        },
        "interaction": {"hover": True, "tooltipDelay": 120}
    }
    net.set_options(json.dumps(options, ensure_ascii=False))

    html_doc = net.generate_html(notebook=False)
    html_doc = html_doc.replace("</head>", _legend_css() + "</head>")
    html_doc = html_doc.replace("<body>", "<body>" + _legend_html())
    return html_doc

# -----------------------
# Routes
# -----------------------
@app.route("/api/health", methods=["GET", "OPTIONS"])
def health():
    if request.method == "OPTIONS": return ("", 204)
    return jsonify({"ok": True, "service": "service_graph", "ner_base": NER_BASE_URL})

@app.route("/api/routes", methods=["GET", "OPTIONS"])
def routes():
    if request.method == "OPTIONS": return ("", 204)
    rules = sorted([str(r.rule) for r in app.url_map.iter_rules()])
    return jsonify({"routes": rules})

@app.route("/api/debug/echo", methods=["POST", "OPTIONS"])
def echo():
    if request.method == "OPTIONS": return ("", 204)
    data = request.get_json(silent=True) or {}
    return jsonify({"ok": True, "data": data})

@app.route("/api/graph/build", methods=["POST", "OPTIONS"])
def graph_build():
    if request.method == "OPTIONS": return ("", 204)

    data = request.get_json(silent=True) or {}
    text = extract_text_field(data)
    if not text.strip():
        return jsonify({"error": "text가 비어 있습니다."}), 400

    try:
        items, _ = call_ner_visualize(text)
    except Exception as e:
        return jsonify({"error": f"NER 호출 실패: {e}"}), 502

    G, nodes, edges = build_graph_from_items(items)
    html_doc = graph_to_html(G, physics=True)

    summary = {
        "num_clauses": len([n for n in G.nodes() if G.nodes[n].get("type") == "CLAUSE"]),
        "num_entities": len([n for n in G.nodes() if G.nodes[n].get("type") != "CLAUSE"]),
        "num_edges": len(G.edges())
    }

    if data.get("save"):
        out_path = os.path.join(os.getcwd(), "graph.html")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html_doc)

    return jsonify({"html": html_doc, "nodes": nodes, "edges": edges, "summary": summary})

# -----------------------
# Entrypoint
# -----------------------
if __name__ == "__main__":
    logger.info(f">>> service_graph STARTED (NER_BASE_URL={NER_BASE_URL})")
    app.run(host="0.0.0.0", port=PORT, debug=True)
