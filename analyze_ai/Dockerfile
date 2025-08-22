# ---- Base ----
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# onnxruntime / tokenizers 등 네이티브 확장 대비
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 build-essential \
 && rm -rf /var/lib/apt/lists/*

# ---- App ----
WORKDIR /app

# requirements 먼저 복사 후 설치 (레이어 캐시 활용)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# 코드 & 데이터 복사 (컨텍스트에 존재해야 함)
COPY analyze_terms.py ./analyze_terms.py
COPY 판례 ./판례

# ---- Runtime env ----
ENV CHROMA_BASE=/app/판례

EXPOSE 8080

# gunicorn으로 실행 (Flask app: analyze_terms:app)
# ※ Cloud Run은 PORT 환경변수를 주입하므로 ${PORT:-8080} 사용 권장
CMD ["bash", "-lc", "exec gunicorn -b 0.0.0.0:${PORT:-8080} analyze_terms:app --workers=1 --threads=4 --timeout=300"]
