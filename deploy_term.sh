#!/bin/bash
set -e

# --- Configuration ---
REGION="us-central1"
PROJECT="aivle-team0721"

TERM_SERVICE_NAME="term-service"
TERM_IMAGE="us-central1-docker.pkg.dev/${PROJECT}/cloud-run-repo/${TERM_SERVICE_NAME}:latest"

# --- Script Execution ---

echo "=== 🔨 Maven 빌드: Term Service ==="
cd term
mvn clean package -DskipTests

JAR_FILE=$(ls target/*SNAPSHOT.jar | head -n 1)
if [ ! -f "$JAR_FILE" ]; then
    echo "❌ JAR 파일을 찾을 수 없습니다. Maven 빌드를 확인하세요."
    exit 1
fi

echo "=== 🐳 Docker 빌드: Term Service ==="
# Build from within the 'term' directory, using its Dockerfile
docker build --platform linux/amd64 -t ${TERM_IMAGE} .

echo "=== ⬆️ Docker 이미지 푸시: Term Service ==="
docker push ${TERM_IMAGE}

echo "=== ☁️ Cloud Run 배포: Term Service ==="
gcloud run deploy ${TERM_SERVICE_NAME} \
  --image ${TERM_IMAGE} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 1 \
  --set-env-vars SPRING_PROFILES_ACTIVE=docker

TERM_URL=$(gcloud run services describe ${TERM_SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo "✅ Term Service URL: ${TERM_URL}"
cd ..

echo "=== ✅ Term Service 배포 완료 ==="
