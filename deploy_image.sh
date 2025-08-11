#!/bin/bash
set -euo pipefail

##############################################
# CONFIG
##############################################
REGION="us-central1"
PROJECT="aivle-team0721"

AI_SERVICE_NAME="image-ai-service"
TAG="v$(date +%Y%m%d-%H%M%S)"
AI_IMAGE_BASE="us-central1-docker.pkg.dev/${PROJECT}/cloud-run-repo/${AI_SERVICE_NAME}"
AI_IMAGE="${AI_IMAGE_BASE}:${TAG}"
AI_IMAGE_LATEST="${AI_IMAGE_BASE}:latest"

##############################################
# 0) gcloud 기본 설정
##############################################
echo "=== 0) gcloud 기본 설정 ==="
gcloud config set project "${PROJECT}" >/dev/null

##############################################
# 1) 필수 도구 확인
##############################################
echo "=== 1) 필수 도구 설치 확인 ==="
command -v docker >/dev/null || { echo "❌ Docker 미설치"; exit 1; }
command -v gcloud >/dev/null || { echo "❌ gcloud 미설치"; exit 1; }

##############################################
# 2) Artifact Registry 준비
##############################################
echo "=== 2) Artifact Registry 준비 ==="
gcloud services enable artifactregistry.googleapis.com --project "${PROJECT}"
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

if ! gcloud artifacts repositories describe cloud-run-repo --location="${REGION}" --project "${PROJECT}" >/dev/null 2>&1; then
  echo "⚠️  cloud-run-repo가 없어 생성합니다."
  gcloud artifacts repositories create cloud-run-repo \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Cloud Run images" \
    --project "${PROJECT}"
fi

##############################################
# 3) buildx 빌더 준비
##############################################
echo "=== 3) buildx 빌더 준비 ==="
if ! docker buildx inspect multiarch-builder >/dev/null 2>&1; then
  docker buildx create --name multiarch-builder --use
fi
docker buildx inspect --bootstrap >/dev/null

##############################################
# 4) Docker 빌드 & 푸시 (linux/amd64)
##############################################
echo "=== 4) Docker 빌드 & 푸시 (linux/amd64) ==="
# --no-cache 옵션을 추가하여 캐시를 무시하고 처음부터 새로 빌드합니다.
docker buildx build \
  --platform linux/amd64 \
  --no-cache \
  -t "${AI_IMAGE}" \
  -t "${AI_IMAGE_LATEST}" \
  -f image_ai/Dockerfile \
  --push \
  ./image_ai

##############################################
# 5) Cloud Run 배포
##############################################
echo "=== 5) Cloud Run 배포 (AI Service) ==="
gcloud run deploy "${AI_SERVICE_NAME}" \
  --image "${AI_IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 1 \
  --project "${PROJECT}"

AI_URL=$(gcloud run services describe "${AI_SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)' --project "${PROJECT}")
echo "✅ AI Service URL: ${AI_URL}"

echo "=== ✅ 배포 완료 ==="
echo "👉 최신 태그: ${AI_IMAGE}"
echo "👉 로그: gcloud run services logs read ${AI_SERVICE_NAME} --region=${REGION} --project=${PROJECT} --limit=100"
