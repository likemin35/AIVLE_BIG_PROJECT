# ---- Base ----
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# onnxruntime / tokenizers가 필요로 하는 런타임 라이브러리
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 build-essential \
    && rm -rf /var/lib/apt/lists/*

# ---- App ----
WORKDIR /app

# requirements 먼저 복사 후 설치 (레이어 캐시)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# 코드 & 벡터DB 복사
COPY analyze_terms.py ./analyze_terms.py
COPY 판례_1x ./판례_1x
# (※ 벡터 DB를 컨테이너 외부에서 마운트할 거면 위 COPY는 빼고
#    docker run 할 때 -v로 /app/판례_1x를 마운트하세요)

# ---- Runtime env ----
ENV CHROMA_BASE=/app/판례_1x \
    PY_PORT=8080

EXPOSE 8080

# gunicorn으로 실행 (Flask의 app 객체 사용)
CMD ["gunicorn", "-b", "0.0.0.0:8080", "analyze_terms:app", "--workers=1", "--threads=4", "--timeout=300"]
