# OpenJDK 15 이미지 사용
FROM eclipse-temurin:11-jre-jammy

# JAR 파일 복사
COPY target/*SNAPSHOT.jar app.jar

# Cloud Run은 8080으로 통신
EXPOSE 8080

# 타임존 설정
ENV TZ=Asia/Seoul
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# ✅ Cloud Run에서 PORT를 런타임 변수로 활용
CMD exec java -Xmx400M \
    -Djava.security.egd=file:/dev/./urandom \
    -jar /app.jar \
    --spring.profiles.active=docker \
    --server.port=${PORT:-8080}
