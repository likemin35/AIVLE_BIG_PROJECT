package self;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.reactive.CorsWebFilter;
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@SpringBootApplication
public class Application {

    public static ApplicationContext applicationContext;

    public static void main(String[] args) {
        applicationContext = SpringApplication.run(Application.class, args);
    }

    @Bean
    public CorsWebFilter corsWebFilter() {
        CorsConfiguration corsConfig = new CorsConfiguration();
        // corsConfig.setAllowedOrigins(Arrays.asList("*")); // 기존 코드 주석 처리
        corsConfig.setAllowedOrigins(Arrays.asList("http://localhost:3000")); // 새 코드 추가
        corsConfig.setMaxAge(3600L);
        corsConfig.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        corsConfig.addAllowedHeader("*");

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        // 모든 경로에 대해 CORS 정책 적용
        source.registerCorsConfiguration("/**", corsConfig);

        return new CorsWebFilter(source);
    }
}
