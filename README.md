# AIVLE_BIG_PROJECT

보험/금융 약관을 생성, 검수, 리스크 분석, 시각화까지 한 흐름으로 다루는 멀티서비스 프로젝트입니다. 현재 레포는 React 프론트엔드, Spring Boot 기반 도메인 서비스, Flask 기반 AI 서비스, Gateway, Docker/Cloud Run/Kubernetes 배포 자산까지 함께 포함하고 있습니다.

배포된 프론트엔드 주소:

- https://front-service-902267887946.us-central1.run.app

## 주요 기능

- AI 약관 초안 생성
- 기존 약관 업로드 및 편집/버전 관리
- 약관 리스크 분석 및 수정안 제안
- 조항 키워드 추출과 관계 그래프 시각화
- 이미지 기반 문구/오탈자 점검
- 포인트 결제/차감
- Q&A 게시판
- Firebase 기반 인증 및 사용자 관리

## 저장소 구조

```text
AIVLE_BIG_PROJECT
├─ frontend/          # React 웹 앱
├─ gateway/           # Spring Cloud Gateway
├─ term/              # 약관 등록/조회/업로드/수정 서비스
├─ point/             # 포인트 조회/충전/차감 서비스
├─ qna/               # Q&A 서비스
├─ user/              # 사용자/인증 관련 서비스
├─ ai/                # 약관 초안 생성 AI 서비스
├─ analyze_ai/        # 약관 리스크 분석 AI 서비스
├─ image_ai/          # 이미지 기반 문구 점검 AI 서비스
├─ keywords_ai/       # 키워드 추출/시각화 관련 AI 서비스
├─ keywords-ner/      # 조항 엔티티 추출 서비스
├─ keywords-graph/    # 조항 관계 그래프 서비스
├─ infra/             # Kafka용 docker-compose
├─ kubernetes/        # 공용 템플릿
├─ .github/           # GitHub 설정
├─ build-docker-compose.yml
├─ deploy*.sh         # 서비스별 배포 스크립트
└─ firebase.json      # Firebase Hosting 설정
```

## 서비스 요약

| 디렉터리 | 스택 | 역할 |
| --- | --- | --- |
| `frontend` | React 19, React Router, Axios, Firebase | 사용자 웹 UI |
| `gateway` | Spring Cloud Gateway | 프론트엔드/API 라우팅 통합 |
| `term` | Spring Boot 2.3, Kafka, Firebase | 약관 업로드, 조회, 편집, 버전 처리 |
| `point` | Spring Boot 2.3, Firestore, Kafka | 포인트 조회/충전/차감 및 이력 |
| `qna` | Spring Boot 2.3, Firestore | 질문/답변 게시판 |
| `user` | Spring Boot 2.3, Firebase Auth, Mail | 회원가입/인증 관련 API |
| `ai` | Flask, Vertex AI, LangChain, Chroma | 약관 초안 생성 |
| `analyze_ai` | Flask, Vertex AI, Chroma | 약관 리스크 분석 및 수정안 생성 |
| `image_ai` | Flask, Vertex AI | 이미지 기반 문구 점검 |
| `keywords_ai` | Flask, Gemini | 조항 키워드 분석/시각화 실험 코드 |
| `keywords-ner` | Flask, Gemini, spaCy | 조항 엔티티 추출 |
| `keywords-graph` | Flask, NetworkX | 조항 관계 그래프 생성 |

## 프론트엔드 화면 기준 기능 흐름

- 홈: 약관 파일 업로드, AI 초안 생성, 이미지 점검, 리스크 분석 진입
- 약관 초안 생성: CSV 입력 파일을 기반으로 약관 초안 생성
- 계약 관리: 업로드된 약관 목록/상세/수정/버전 관리
- 리스크 분석: 텍스트 또는 파일 기준 위험 조항 분석
- 시각화: 조항 간 관계를 그래프로 표시
- 포인트: 잔액, 사용 이력, 충전
- Q&A: 질문/답변 작성과 조회
- 설정/마이페이지: 사용자 정보 확인

## 로컬 실행 전 준비

### 필수 도구

- Java 11
- Maven
- Node.js 18 이상 / npm
- Python 3.10 이상
- Docker

### 외부 의존성

- Kafka
- Firebase 프로젝트 설정
- 일부 AI 서비스용 Google Cloud 인증
- Vertex AI / Secret Manager / GCS 접근 권한

### 확인해둘 점

- `frontend/src/firebase.js`는 `REACT_APP_FIREBASE_*` 환경변수를 사용합니다.
- `ai`, `analyze_ai`, `image_ai`, `keywords_ai`, `keywords-ner`는 Google Cloud 인증 또는 로컬 서비스 계정 키 파일이 필요합니다.
- `ai`, `analyze_ai`는 `TERMS_VECTOR_BUCKET` 환경변수와 벡터 DB 접근이 필요합니다.
- 로컬 기본 포트가 일부 겹칩니다. 특히 여러 Python 서비스와 `user` 서비스는 기본값이 `8080`이라 동시에 띄우려면 포트 조정이 필요합니다.

## 빠른 시작

### 1. Kafka 실행

레포에는 Kafka용 compose 파일이 `infra/docker-compose.yml`에 있습니다.

```bash
cd infra
docker compose up -d
```

### 2. 프론트엔드 실행

```bash
cd frontend
npm install
npm start
```

기본 개발 서버는 `http://localhost:3000`입니다.

### 3. Gateway 실행

```bash
cd gateway
mvn spring-boot:run
```

Gateway 기본 포트:

- `http://localhost:8088`

현재 Gateway 설정상 주요 라우트는 아래와 같습니다.

- `/terms/**` -> `term` 서비스
- `/api/points/**`, `/points/**` -> `point` 서비스
- `/qna/**` -> `qna` 서비스
- `/api/generate/**` -> `ai`
- `/api/analyze-terms**` -> `analyze_ai`
- `/ner/**` -> `keywords-ner`
- `/keywords/**` -> `keywords_ai`

### 4. Spring 서비스 실행

```bash
cd term
mvn spring-boot:run
```

```bash
cd point
mvn spring-boot:run
```

```bash
cd qna
mvn spring-boot:run
```

```bash
cd user
mvn spring-boot:run
```

현재 설정 파일 기준 로컬 포트:

- `gateway`: `8088`
- `term`: `8083`
- `point`: `8085`
- `qna`: `8086`
- `user`: 기본값 `8080`

### 5. Python/AI 서비스 실행

예시는 공통 패턴만 적었습니다. 각 디렉터리의 `requirements.txt`와 엔트리 파일을 기준으로 실행하면 됩니다.

`ai`

```bash
cd ai
pip install -r requirements.txt
python Create_Terms.py
```

`analyze_ai`

```bash
cd analyze_ai
pip install -r requirements.txt
python analyze_terms.py
```

`image_ai`

```bash
cd image_ai
pip install -r requirements.txt
python main.py
```

`keywords-ner`

```bash
cd keywords-ner
pip install -r requirements.txt
python keywords.py
```

`keywords-graph`

```bash
cd keywords-graph
pip install -r requirements.txt
python network.py
```

`keywords_ai`

```bash
cd keywords_ai
pip install -r requirements.txt
python main.py
```

## 배포 주소

- 프론트엔드: https://front-service-902267887946.us-central1.run.app

## 실행 시 참고할 파일

- `infra/docker-compose.yml`: 로컬 Kafka 실행
- `build-docker-compose.yml`: 과거/보조용 전체 빌드 구성
- `gateway/src/main/resources/application.yml`: 로컬/도커 라우팅 정의
- `frontend/package.json`: 프론트엔드 실행 스크립트
- `term/src/main/resources/application.yml`: 약관 서비스 포트/Kafka 설정
- `point/src/main/resources/application.yml`: 포인트 서비스 포트/Kafka 설정
- `qna/src/main/resources/application.yml`: Q&A 서비스 포트 설정
- `user/src/main/resources/application.yml`: 메일/Firebase 설정

## 배포 관련 파일

루트에는 서비스별 배포 스크립트가 이미 정리되어 있습니다.

- `deploy.sh`
- `deploy_ai.sh`
- `deploy_analyze.sh`
- `deploy_graph.sh`
- `deploy_image.sh`
- `deploy_ner.sh`
- `deploy_point.sh`
- `deploy_term.sh`
- `deploy_terms.sh`

스크립트 내용을 보면 현재 배포 대상은 주로 Google Cloud Run / Artifact Registry 조합입니다. 또한 각 서비스 폴더 안에는 `Dockerfile`, `kubernetes/`, 일부는 `cloudbuild.yaml`이 포함되어 있어 컨테이너 배포와 쿠버네티스 배포를 모두 고려한 구조입니다.

## 환경변수 예시

프론트엔드:

- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_DATABASE_URL`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_TERM_API_BASE_URL`
- `REACT_APP_QNA_API_BASE_URL`
- `REACT_APP_POINT_API_BASE_URL`
- `REACT_APP_ANALYZE_API_BASE_URL`
- `REACT_APP_CREATE_API_BASE_URL`
- `REACT_APP_KEYWORD_NER_API_BASE_URL`
- `REACT_APP_KEYWORD_GRAPH_API_BASE_URL`

AI/백엔드에서 확인되는 값:

- `PORT`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `TERMS_VECTOR_BUCKET`
- `TERM_SERVICE_URL`
- `POINT_SERVICE_URL`
- `FRONTEND_URL`
- `SPRING_PROFILES_ACTIVE`

## 참고 사항

- 루트 `package.json`은 `firebase` 의존성만 가진 매우 얇은 파일이며, 실제 웹앱 실행은 `frontend/`에서 이뤄집니다.
- 서비스별 세부 실행법은 각 하위 디렉터리의 `README.md`와 `Dockerfile`도 함께 보는 편이 좋습니다.
- 현재 레포에는 로컬/도커/클라우드 설정이 함께 섞여 있으므로, 실제 통합 실행 시 포트와 인증값을 먼저 맞추는 것이 가장 중요합니다.
