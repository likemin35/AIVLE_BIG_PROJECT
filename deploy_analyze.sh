#!/bin/bash
# 배포 스크립트 (Cloud Run + Artifact Registry)
# - 로컬 buildx 푸시가 불안하면 USE_CLOUD_BUILD=1 로 전환
# - 에러 시 즉시 중단, 에러 위치 출력
set -Eeuo pipefail
trap 'echo "ERROR at line $LINENO" >&2' ERR

##############################################
# CONFIG
##############################################
REGION="us-central1"
PROJECT="aivle-team0721"

AI_SERVICE_NAME="analyze-service"
AI_IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/cloud-run-repo/${AI_SERVICE_NAME}:latest"

# 외부 서비스 URL
TERM_SERVICE_URL="https://term-service-902267887946.us-central1.run.app"
POINT_SERVICE_URL="https://point-service-902267887946.us-central1.run.app"

# 빌드 방식: 0=로컬 buildx, 1=Cloud Build(권장: 네트워크/푸시 안정)
USE_CLOUD_BUILD="${USE_CLOUD_BUILD:-0}"

##############################################
# 0) 전제 도구/프로젝트 설정
##############################################
echo "=== 0) 도구/프로젝트 설정 ==="
command -v docker >/dev/null || { echo "❌ Docker 미설치"; exit 1; }
command -v gcloud >/dev/null || { echo "❌ gcloud 미설치"; exit 1; }

# gcloud 프로젝트 고정
gcloud config set project "${PROJECT}" >/dev/null

# 필수 API 켜기
gcloud services enable artifactregistry.googleapis.com run.googleapis.com >/dev/null

# 리포지토리 존재 보장
if ! gcloud artifacts repositories describe cloud-run-repo --location "${REGION}" --project "${PROJECT}" >/dev/null 2>&1; then
  echo "리포지토리 생성: cloud-run-repo (${REGION})"
  gcloud artifacts repositories create cloud-run-repo \
    --repository-format=docker \
    --location "${REGION}" \
    --project "${PROJECT}"
fi

##############################################
# 1) Docker buildx 준비
##############################################
echo "=== 1) buildx 준비 ==="
docker buildx create --use >/dev/null 2>&1 || true
docker buildx inspect --bootstrap >/dev/null 2>&1 || true

##############################################
# 2) Artifact Registry 인증
##############################################
echo "=== 2) Artifact Registry 인증 ==="
gcloud auth configure-docker "${REGION}-docker.pkg.dev" -q
# 혹시 이전 세션 꼬임 방지용
docker logout "https://${REGION}-docker.pkg.dev" >/dev/null 2>&1 || true
gcloud auth print-access-token | docker login -u oauth2accesstoken --password-stdin "https://${REGION}-docker.pkg.dev" >/dev/null

##############################################
# 3) 빌드 & 푸시
##############################################
echo "=== 3) 빌드 & 푸시 ==="
if [[ "${USE_CLOUD_BUILD}" == "1" ]]; then
  echo "Cloud Build로 원격 빌드/푸시"
  gcloud services enable cloudbuild.googleapis.com >/dev/null
  # analyze_ai 디렉터리를 빌드 컨텍스트로 사용
  gcloud builds submit analyze_ai \
    --region "${REGION}" \
    --tag "${AI_IMAGE}" \
    --project "${PROJECT}"
else
  echo "로컬 buildx 빌드/푸시 (linux/amd64)"
  docker buildx build \
    --platform linux/amd64 \
    -t "${AI_IMAGE}" \
    -f analyze_ai/Dockerfile \
    --push \
    analyze_ai
fi

##############################################
# 4) Cloud Run 배포
##############################################
echo "=== 4) Cloud Run 배포 ==="
# 컨테이너가 $PORT 리스닝하도록 Dockerfile CMD에서 ${PORT:-8080} 사용 권장
gcloud run deploy "${AI_SERVICE_NAME}" \
  --image "${AI_IMAGE}" \
  --project "${PROJECT}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --max-instances 1 \
  --set-env-vars "TERM_SERVICE_URL=${TERM_SERVICE_URL},POINT_SERVICE_URL=${POINT_SERVICE_URL}"

AI_URL="$(gcloud run services describe "${AI_SERVICE_NAME}" --region "${REGION}" --project "${PROJECT}" --format='value(status.url)')"
echo "✅ AI Service URL: ${AI_URL}"

##############################################
# 5) 로그 안내
##############################################
echo "=== ✅ 배포 완료 ==="
echo "👉 Logs: gcloud run services logs read ${AI_SERVICE_NAME} --region=${REGION} --project=${PROJECT} --limit=100"
