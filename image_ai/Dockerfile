# 파이썬 공식 이미지를 기반으로 사용 (slim 대신 표준 이미지로 변경)
FROM python:3.10

# 작업 디렉토리를 /app으로 설정
WORKDIR /app

# 시스템 의존성 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# requirements.txt 복사
COPY requirements.txt .

# pip/setuptools/wheel 최신화 후 라이브러리 설치
RUN python -m pip install --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 파일 복사
COPY main.py .

# 포트 8080 노출
EXPOSE 8080

# Gunicorn으로 Flask 실행
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "main:app"]
