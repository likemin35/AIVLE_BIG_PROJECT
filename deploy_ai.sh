#!/bin/bash
set -e

##############################################
# CONFIG
##############################################
REGION="us-central1"
PROJECT="aivle-team0721"

# 서비스 이름 및 이미지 경로 설정
AI_SERVICE_NAME="terms-api-service" # 기존 terms-api-service에서 변경
AI_IMAGE="us-central1-docker.pkg.dev/${PROJECT}/cloud-run-repo/${AI_SERVICE_NAME}:latest"

# 배포된 다른 서비스들의 URL (반드시 실제 URL로 교체해야 합니다)
TERM_SERVICE_URL="https://term-service-902267887946.us-central1.run.app"
POINT_SERVICE_URL="https://point-service-902267887946.us-central1.run.app"

##############################################
# 1) 필수 도구 설치 확인
##############################################
echo "=== 1) 필수 도구 설치 확인 ==="
if ! command -v docker &> /dev/null; then
    echo "❌ Docker가 설치되어 있지 않습니다."
    exit 1
fi

if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI(gcloud)가 설치되어 있지 않습니다."
    exit 1
fi

##############################################
# 2) AI 서비스 빌드 & 배포
##############################################
echo "=== 2) Docker 빌드 (AI Service) ==="
# deploy.sh와 동일하게, 프로젝트 루트에서 빌드 컨텍스트를 사용합니다.
# -f 플래그로 ai/Dockerfile을 명시적으로 지정합니다.
docker build -t ${AI_IMAGE} -f ai/Dockerfile .

echo "=== 3) Docker 이미지 푸시 (AI Service) ==="
docker push ${AI_IMAGE}

echo "=== 4) Cloud Run 배포 (AI Service) ==="
gcloud run deploy ${AI_SERVICE_NAME} \
  --image ${AI_IMAGE} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 1 \
  --set-env-vars="TERM_SERVICE_URL=${TERM_SERVICE_URL},POINT_SERVICE_URL=${POINT_SERVICE_URL}"

AI_URL=$(gcloud run services describe ${AI_SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo "✅ AI Service URL: ${AI_URL}"

##############################################
# 5) 로그 안내
##############################################
echo "=== ✅ AI Service 배포 완료 ==="
echo "👉 AI Service Logs: gcloud run services logs read ${AI_SERVICE_NAME} --region=${REGION} --project=${PROJECT} --limit=100"