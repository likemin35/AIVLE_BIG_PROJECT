package self.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;
import org.springframework.http.HttpMethod;

@Configuration
@EnableWebSecurity
public class SecurityConfig extends WebSecurityConfigurerAdapter {

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http
                .csrf().disable() // CSRF 비활성화 (개발용, 운영 시 별도 설정 필요)
                .authorizeRequests()
                .antMatchers("/api/auth/signup", "/test", "/api/users/me", "/api/users/me/profile").permitAll()
                .anyRequest().authenticated();
    }
}
