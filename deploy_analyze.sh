#!/bin/bash
set -e

##############################################
# CONFIG
##############################################
REGION="us-central1"
PROJECT="aivle-team0721"

AI_SERVICE_NAME="analyze-service"
AI_IMAGE="us-central1-docker.pkg.dev/${PROJECT}/cloud-run-repo/${AI_SERVICE_NAME}:latest"

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
# 2) buildx 준비 (멀티아키 빌드용)
##############################################
echo "=== buildx 준비 ==="
# 이미 기본 builder가 있으면 생략되어도 무방
docker buildx create --use >/dev/null 2>&1 || true
docker buildx inspect --bootstrap >/dev/null 2>&1 || true

##############################################
# 3) AI 서비스 빌드 & 푸시 (linux/amd64)
##############################################
echo "=== 2) Docker 빌드 & 푸시 (AI Service: linux/amd64) ==="
# Cloud Run이 요구하는 linux/amd64 아키텍처로 빌드/푸시
docker buildx build \
  --platform linux/amd64 \
  -t "${AI_IMAGE}" \
  -f analyze_ai/Dockerfile \
  --push \
  .

##############################################
# 4) Cloud Run 배포
##############################################
echo "=== 4) Cloud Run 배포 (AI Service) ==="
gcloud run deploy "${AI_SERVICE_NAME}" \
  --image "${AI_IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 1 \
  --set-env-vars="TERM_SERVICE_URL=${TERM_SERVICE_URL},POINT_SERVICE_URL=${POINT_SERVICE_URL}"

AI_URL=$(gcloud run services describe "${AI_SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')
echo "✅ AI Service URL: ${AI_URL}"

##############################################
# 5) 로그 안내
##############################################
echo "=== ✅ AI Service 배포 완료 ==="
echo "👉 AI Service Logs: gcloud run services logs read ${AI_SERVICE_NAME} --region=${REGION} --project=${PROJECT} --limit=100"
