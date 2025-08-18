#!/bin/bash
set -e

##############################################
# CONFIG
##############################################
REGION="us-central1"
PROJECT="aivle-team0721"

SERVICE_NAME="graph-api-service"
IMAGE="us-central1-docker.pkg.dev/${PROJECT}/cloud-run-repo/${SERVICE_NAME}:latest"

# This should be the URL of the deployed NER service
NER_SERVICE_URL="https://ner-api-service-902267887946.us-central1.run.app"

##############################################
# 1) Build and Push Docker Image
##############################################
echo "=== Building and pushing Docker image for ${SERVICE_NAME} ==="
docker buildx build \
  --platform linux/amd64 \
  -t "${IMAGE}" \
  -f keywords-graph/Dockerfile \
  --push \
  .

##############################################
# 2) Deploy to Cloud Run
##############################################
echo "=== Deploying ${SERVICE_NAME} to Cloud Run ==="
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 1 \
  --set-env-vars="NER_BASE_URL=${NER_SERVICE_URL}"

SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')
echo "✅ ${SERVICE_NAME} deployed successfully."
echo "✅ URL: ${SERVICE_URL}"
