# ---------- Build stage ----------
# Maven + JDK 17 (amd64로 고정: Cloud Run 호환)
FROM --platform=linux/amd64 maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build

# 의존성 캐시를 위해 pom.xml만 먼저 복사 후 go-offline
COPY pom.xml .
RUN mvn -B -q -DskipTests dependency:go-offline

# 소스 복사 후 빌드
COPY src ./src
RUN mvn -B -q -DskipTests clean package

# ---------- Runtime stage ----------
# 가벼운 JRE 17 이미지
FROM --platform=linux/amd64 eclipse-temurin:17-jre-alpine
WORKDIR /app

# 시간대 설정
ENV TZ=Asia/Seoul
RUN apk add --no-cache tzdata && \
    ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 빌드 결과 JAR 복사 (SNAPSHOT/릴리스 모두 매칭)
COPY --from=build /build/target/*.jar /app/app.jar

# Cloud Run 표준 포트
ENV PORT=8080
EXPOSE 8080

# 컨테이너 메모리 인지 & OOM 시 즉시 종료
ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+ExitOnOutOfMemoryError"

# Arena/메모리 단편화 줄이기 (glibc 아님, alpine이라 영향 적지만 관성상 넣어둠)
ENV MALLOC_ARENA_MAX=2

# 프로파일 docker로 실행
ENTRYPOINT ["java","-jar","/app/app.jar","--spring.profiles.active=docker"]
