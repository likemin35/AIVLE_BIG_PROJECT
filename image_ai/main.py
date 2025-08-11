import os
import io
import json
import logging
from PIL import Image
from flask import Flask, request, jsonify

# Google Cloud SDK 및 Vertex AI 관련 라이브러리 임포트
from google.auth import service_account
from google.cloud import secretmanager
import vertexai
from vertexai.generative_models import GenerativeModel, Part

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Vertex AI 및 모델 설정 (Secret Manager 연동) ---
PROJECT_ID = "aivle-team0721"
LOCATION = "us-central1"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_KEY_FILE = os.path.join(BASE_DIR, "firebase-adminsdk.json")
gemini_model = None

try:
    # Secret Manager에서 서비스 계정 키를 로드
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
        # Secret Manager에 접근 실패 시, 로컬 키 파일을 사용
        if not os.path.exists(LOCAL_KEY_FILE):
            raise FileNotFoundError("로컬 서비스 계정 키 파일을 찾을 수 없습니다: " + LOCAL_KEY_FILE)
        credentials = service_account.Credentials.from_service_account_file(LOCAL_KEY_FILE)
        logging.info("로컬 파일에서 서비스 계정 키 로드 성공")
    except Exception as file_e:
        logging.error(f"AI 서비스 초기화 실패: Secret Manager와 로컬 파일 모두 실패. ({file_e})")
        credentials = None

if credentials:
    try:
        # Vertex AI 초기화 및 Gemini 모델 설정
        vertexai.init(project=PROJECT_ID, location=LOCATION, credentials=credentials)
        logging.info("Vertex AI 초기화 성공")
        # 이미지 처리를 위해 gemini-1.0-pro-vision 모델 사용
        gemini_model = GenerativeModel("gemini-1.0-pro-vision")
        logging.info("Gemini Vision 모델 초기화 성공")
    except Exception as e:
        logging.error(f"Vertex AI 또는 Gemini 모델 초기화 실패: {e}")
else:
    logging.error("인증 실패로 인해 Gemini 모델을 사용할 수 없습니다.")

app = Flask(__name__)

@app.route("/", methods=["POST"])
def check_spelling():
    """
    POST 요청으로 이미지를 받아 Gemini API로 오탈자를 검수합니다.
    """
    if not gemini_model:
        return jsonify({"error": "Gemini model is not initialized"}), 500

    if "file" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    if file:
        try:
            # 업로드된 이미지 데이터를 바이트 형태로 읽고, Gemini 모델에 적합한 Part 객체로 변환
            img_bytes = file.read()
            image_part = Part.from_data(data=img_bytes, mime_type=file.mimetype)

            # 오탈자 검수 프롬프트
            prompt = "이 이미지에 있는 텍스트의 오탈자를 검수하고, 잘못된 부분을 올바른 단어로 고쳐줘. 그리고 추가로 다른 설명 없이 오탈자 수정 내용만 알려줘."
            
            # Gemini 모델에 프롬프트와 이미지 데이터 전달
            response = gemini_model.generate_content([prompt, image_part])
            
            # 응답을 JSON 형식으로 반환
            return jsonify({
                "original_filename": file.filename,
                "spell_check_result": response.text
            })
            
        except Exception as e:
            logging.error(f"API 호출 중 오류 발생: {e}")
            return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Cloud Run 환경에서 포트 환경 변수를 사용하도록 설정
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))

