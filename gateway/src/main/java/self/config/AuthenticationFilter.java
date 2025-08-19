package self.config;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;

@Component
public class AuthenticationFilter implements GlobalFilter, Ordered {

    @Autowired
    private FirebaseAuth firebaseAuth;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String authToken = this.getAuthToken(request);

        // 비로그인 사용자의 qna GET 요청은 허용
        if (authToken == null && request.getMethod().matches("GET") && request.getURI().getPath().startsWith("/qna")) {
            return chain.filter(exchange);
        }

        // 인증 엔드포인트는 허용
        List<String> path = List.of(request.getURI().getPath().split("/"));
        if (path.contains("auth")) {
            return chain.filter(exchange);
        }

        // 위 조건에 해당하지 않는데 토큰이 없으면 거부
        if (authToken == null) {
            return this.onError(exchange, "Authorization header is missing or invalid");
        }

        // 토큰이 있으면 검증하고 uid를 헤더에 추가
        try {
            FirebaseToken decodedToken = firebaseAuth.verifyIdToken(authToken);
            String uid = decodedToken.getUid();

            ServerHttpRequest modifiedRequest = request.mutate()
                    .headers(httpHeaders -> httpHeaders.set("X-Authenticated-User-Uid", uid))
                    .build();

            return chain.filter(exchange.mutate().request(modifiedRequest).build());
        } catch (Exception e) {
            return this.onError(exchange, "Invalid authentication token");
        }
    }

    private Mono<Void> onError(ServerWebExchange exchange, String err) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
    }

    private String getAuthToken(ServerHttpRequest request) {
        String header = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }

    @Override
    public int getOrder() {
        return -1; // Run before other filters
    }
}