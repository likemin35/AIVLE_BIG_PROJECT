#!/bin/bash
set -e

REGION="us-central1"
PROJECT="aivle-team0721"

POINT_SERVICE_NAME="point-service"
POINT_IMAGE="us-central1-docker.pkg.dev/${PROJECT}/cloud-run-repo/point-api:latest"

echo "=== 🔨 Maven 빌드: Point API ==="
cd point
mvn clean package -DskipTests

JAR_FILE=$(ls target/*SNAPSHOT.jar | head -n 1)
if [ ! -f "$JAR_FILE" ]; then
    echo "❌ JAR 파일을 찾을 수 없습니다. Maven 빌드를 확인하세요."
    exit 1
fi

echo "=== 🐳 Docker 빌드: Point API ==="
docker build --platform linux/amd64 -t $POINT_IMAGE .
docker push $POINT_IMAGE

echo "=== ☁️ Cloud Run 배포: Point API ==="
gcloud run deploy $POINT_SERVICE_NAME \
  --image $POINT_IMAGE \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 1 \
  --set-env-vars SPRING_PROFILES_ACTIVE=docker

POINT_URL=$(gcloud run services describe $POINT_SERVICE_NAME --region $REGION --format 'value(status.url)')
echo "✅ Point API URL: $POINT_URL"
cd ..

echo "=== ✅ Point API 배포 완료 ==="
