import os
import io
import json
import logging
from PIL import Image
from flask import Flask, request, jsonify

from google.oauth2 import service_account
from google.cloud import secretmanager
import vertexai
from vertexai.generative_models import GenerativeModel, Part
from flask_cors import CORS

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

PROJECT_ID = "aivle-team0721"
LOCATION = "us-central1"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_KEY_FILE = os.path.join(BASE_DIR, "firebase-adminsdk.json")
gemini_model = None
credentials = None

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
        logging.info("Vertex AI 초기화 성공")
        # ✅ 최신 가용 모델로 교체 (예: gemini-2.0-flash)
        gemini_model = GenerativeModel("gemini-2.0-flash")
        logging.info("Gemini(2.0-flash) 모델 초기화 성공")
    except Exception as e:
        logging.error(f"Vertex AI 또는 Gemini 모델 초기화 실패: {e}")
else:
    logging.error("인증 실패로 인해 Gemini 모델을 사용할 수 없습니다.")

app = Flask(__name__)
CORS(app)  # 필요시 origins=["http://34.54.82.32", "https://YOUR-DOMAIN"] 등으로 제한

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/", methods=["POST"])
def check_spelling():
    if not gemini_model:
        return jsonify({"error": "Gemini model is not initialized"}), 500

    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    try:
        img_bytes = file.read()
        image_part = Part.from_data(data=img_bytes, mime_type=file.mimetype)

        prompt = (
            "이 약관 이미지에 있는 텍스트의 오탈자를 검수하고, 잘못된 부분을 올바른 단어로 고쳐줘. "
            "수정 전 전문을 출력해주고, 출력내용 뒤에 ##을 붙인 수정한 전문을 출력해줘. 가장 하단에 $$수정전 내용 1 -> 수정후 내용1 $$수정전 내용2 -> 수정후 내용2 이렇게 출력해줘 예시를 들자면 수정 전 전문 ## 수정 후 전문 $$태스트 -> 테스트 $$악관 -> 약관 이런식으로."
            "다른 설명 없이 해당 내용만 출력해줘"
        )

        response = gemini_model.generate_content([prompt, image_part])

        return jsonify({
            "original_filename": file.filename,
            "spell_check_result": response.text
        }), 200

    except Exception as e:
        logging.error(f"API 호출 중 오류 발생: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
