FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 최소 시스템 패키지
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# pip 안정 버전
RUN pip install --no-cache-dir --upgrade pip==23.3.2

# requirements 설치
RUN pip install --no-cache-dir -r requirements.txt

# 코드 복사
COPY analyze_terms.py .

EXPOSE 8080

CMD ["gunicorn", "-b", "0.0.0.0:8080", "analyze_terms:app", "--workers=1", "--threads=4", "--timeout=300"]
