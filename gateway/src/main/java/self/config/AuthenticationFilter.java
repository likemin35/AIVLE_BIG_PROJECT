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
import java.util.Set;

@Component
public class AuthenticationFilter implements GlobalFilter, Ordered {

    private static final Set<String> PUBLIC_FRONTEND_PATHS = Set.of(
        "/",
        "/login",
        "/signup",
        "/complete-signup",
        "/reset-password",
        "/about"
    );

    @Autowired
    private FirebaseAuth firebaseAuth;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();
        String authToken = getAuthToken(request);

        if ("OPTIONS".equalsIgnoreCase(request.getMethodValue())) {
            return chain.filter(exchange);
        }

        if (authToken == null && request.getMethod().matches("GET") && path.startsWith("/qna")) {
            return chain.filter(exchange);
        }

        List<String> segments = List.of(path.split("/"));
        if (segments.contains("auth")) {
            return chain.filter(exchange);
        }

        if (authToken == null && isPublicFrontendPath(path)) {
            return chain.filter(exchange);
        }

        if (authToken == null) {
            return onError(exchange);
        }

        try {
            FirebaseToken decodedToken = firebaseAuth.verifyIdToken(authToken);
            String uid = decodedToken.getUid();

            ServerHttpRequest modifiedRequest = request.mutate()
                .headers(headers -> headers.set("X-Authenticated-User-Uid", uid))
                .build();

            return chain.filter(exchange.mutate().request(modifiedRequest).build());
        } catch (Exception e) {
            return onError(exchange);
        }
    }

    private Mono<Void> onError(ServerWebExchange exchange) {
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

    private boolean isPublicFrontendPath(String path) {
        if (PUBLIC_FRONTEND_PATHS.contains(path)) {
            return true;
        }

        return path.startsWith("/static/")
            || path.startsWith("/fonts/")
            || path.equals("/favicon.ico")
            || path.equals("/manifest.json")
            || path.equals("/robots.txt")
            || path.endsWith(".js")
            || path.endsWith(".css")
            || path.endsWith(".png")
            || path.endsWith(".jpg")
            || path.endsWith(".jpeg")
            || path.endsWith(".svg")
            || path.endsWith(".ico");
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
