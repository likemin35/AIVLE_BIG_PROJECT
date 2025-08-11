# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify
from flask_cors import CORS, cross_origin
import vertexai
import os
import re
import json
import logging
from google.oauth2 import service_account
from langchain_google_vertexai import ChatVertexAI
import spacy
from spacy import displacy

# --- Initialization ---

# Flask App & CORS
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Logging
logging.basicConfig(level=logging.INFO)

# Vertex AI Configuration
PROJECT_ID = "aivle-team0721" # Or your project ID
LOCATION = "us-central1"
# Assuming the service account file is in the same directory or a known path
# In a real server, this path should be managed securely.
SERVICE_ACCOUNT_FILE = os.path.join(os.path.dirname(__file__), "the-method-467402-k4-3b6511ed1f9e.json")

try:
    # Vertex AI Authentication
    credentials = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_FILE)
    vertexai.init(project=PROJECT_ID, location=LOCATION, credentials=credentials)
    
    # Initialize LLM
    gemini_llm = ChatVertexAI(model_name="gemini-1.5-flash-001", location=LOCATION) # Using a recommended model
except Exception as e:
    logging.error(f"Failed to initialize Vertex AI: {e}")
    gemini_llm = None

# SpaCy Model for visualization
nlp = spacy.blank("en")

# --- Prompt Templates and Constants ---

NER_PROMPT_TEMPLATE = """
You are an expert in analyzing legal and insurance documents. Your task is to extract key entities from a single clause of an insurance policy.

Analyze the following clause and extract entities based on the specified labels.

**Clause to Analyze:**
{clause_korean}

**Instructions:**
1.  Identify and extract keywords that match the labels defined below.
2.  The output MUST be a single JSON object. Do not wrap it in a list or markdown code blocks (```json ... ```).
3.  The JSON object must have two keys: "text" (the original clause) and "entities" (a list of extracted entities).
4.  For each entity, provide "text" (the extracted keyword), "label", "start" (the character start index in the original clause), and "end" (the character end index).
5.  Ensure the `start` and `end` offsets are accurate.
6.  Only use the provided labels. Do not create new ones.

**Allowed Labels:**
- **CLAUSE_ID**: The identifier of the clause, e.g., "제3조" from "제3조 (보장개시일)".
- **CLAUSE_REF**: A reference to another clause, e.g., "제5조" from "제5조에 따라".
- **LAW_REF**: A reference to a law, e.g., "상법 제103조".
- **CONDITION**: A condition or situation for an action, e.g., "보험료를 미납한 경우".
- **ORGANIZATION**: An organization or party to the contract, e.g., "회사", "계약자".
- **TIME_DURATION**: A specific period or date, e.g., "3년간", "2025.04.03", "3영업일".

**JSON Output Format:**
{{
  "text": "The full original clause text...",
  "entities": [
    {{ "text": "keyword1", "label": "LABEL", "start": 0, "end": 5 }},
    ...
  ]
}}
"""

VISUALIZATION_COLORS = {
    "CLAUSE_ID": "#ffe6e6",
    "CLAUSE_REF": "#e6f0ff",
    "LAW_REF": "#fff2cc",
    "CONDITION": "#ffe6f7",
    "ORGANIZATION": "#f0e6ff",
    "TIME_DURATION": "#fff0e6"
}

# --- Helper Functions ---

def split_text_into_clauses(text):
    """Splits the full text into individual clauses based on regex."""
    pattern = re.compile(r"^제\\d+조\\s*\\(.*?\\)\\s*$", re.MULTILINE)
    matches = list(pattern.finditer(text))
    clauses = []

    if not matches:
        if text.strip():
             clauses.append({"clause_id": "전체", "korean": text.strip()})
        return clauses

    # Preamble (content before the first clause)
    if matches[0].start() > 0:
        preamble = text[:matches[0].start()].strip()
        if preamble:
            clauses.append({"clause_id": "머리말", "korean": preamble})

    # Extract each clause
    for i, match in enumerate(matches):
        clause_id = match.group().strip()
        start = match.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        body = re.sub(r"\\*+", "", body) # Clean up asterisks
        clauses.append({"clause_id": clause_id, "korean": body})
        
    return clauses

def get_entities_from_gemini(clause_text):
    """Calls Gemini to perform NER on a single clause."""
    if not gemini_llm:
        raise ConnectionError("Vertex AI LLM not initialized.")

    prompt = NER_PROMPT_TEMPLATE.format(clause_korean=clause_text)
    
    try:
        response = gemini_llm.invoke(prompt)
        content = response.content.strip()
        
        # Clean up potential markdown
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0].strip()
            
        parsed_json = json.loads(content)
        return parsed_json

    except (json.JSONDecodeError, AttributeError, Exception) as e:
        logging.error(f"Failed to parse Gemini response for clause: {clause_text[:50]}... Error: {e}")
        return {"text": clause_text, "entities": []}


def generate_html_visualization(ner_results):
    """Generates a single HTML file from a list of NER results."""
    html_results = []
    options = {"colors": VISUALIZATION_COLORS}

    for result in ner_results:
        text = result.get("text", "")
        entities = result.get("entities", [])
        
        if not text or not entities:
            continue

        doc = nlp.make_doc(text)
        ents = []
        # Use char_span to create spans from character offsets
        for ent in entities:
            span = doc.char_span(ent['start'], ent['end'], label=ent['label'])
            if span is not None:
                ents.append(span)
        
        # Filter out overlapping spans to prevent errors
        doc.ents = spacy.util.filter_spans(ents)

        raw_html = displacy.render(doc, style="ent", options=options, jupyter=False)
        clause_id = text.splitlines()[0].strip()

        html_block = f"""
            <hr style='margin:30px 40px; border: 1px solid #ccc;'>
            <h3 style='margin-left:40px;'>{clause_id}</h3>
            <div style='margin:20px 40px;'>{raw_html}</div>
        """
        html_results.append(html_block)

    # Combine all HTML blocks into a single page
    full_html = "<html><head><meta charset='utf-8'></head><body>"
    full_html += "\n".join(html_results)
    full_html += "</body></html>"
    
    return full_html

# --- API Endpoint ---

@app.route('/api/visualize', methods=['POST', 'OPTIONS'])
@cross_origin(origin='*')
def visualize_terms():
    if request.method == 'OPTIONS':
        return jsonify({'status': 'ok'}), 200

    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({"error": "요청 데이터에 'text' 필드가 없습니다."}), 400

        raw_text = data['text']
        
        # 1. Split text into clauses
        clauses = split_text_into_clauses(raw_text)
        if not clauses:
            return jsonify({"error": "텍스트에서 조항을 추출할 수 없습니다."}), 400

        # 2. Perform NER on each clause
        ner_results = [get_entities_from_gemini(c['korean']) for c in clauses]
        
        # 3. Generate HTML visualization
        final_html = generate_html_visualization(ner_results)

        return jsonify({"html": final_html})

    except Exception as e:
        logging.exception("약관 시각화 중 오류 발생")
        return jsonify({"error": str(e)}), 500

# --- Server Execution ---

if __name__ == '__main__':
    # Use Gunicorn or another production server in a real environment
    app.run(host='0.0.0.0', port=8081, debug=True) # Using a different port to avoid conflict