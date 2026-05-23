package self.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import javax.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;

@Service
public class PointBootstrapClient {

    @Value("${POINT_SERVICE_BASE_URL:http://localhost:8085}")
    private String pointServiceBaseUrl;

    @Value("${POINT_SERVICE_CONNECT_TIMEOUT_MS:3000}")
    private int connectTimeoutMs;

    @Value("${POINT_SERVICE_READ_TIMEOUT_MS:10000}")
    private int readTimeoutMs;

    @Value("${INTERNAL_CALLBACK_TOKEN:}")
    private String internalCallbackToken;

    private RestTemplate restTemplate;

    @PostConstruct
    void init() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    public void bootstrap(String userId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (internalCallbackToken != null && !internalCallbackToken.isBlank()) {
            headers.setBearerAuth(internalCallbackToken);
        }
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(new HashMap<>(), headers);
        restTemplate.exchange(
            pointServiceBaseUrl + "/api/points/internal/bootstrap/" + userId,
            HttpMethod.POST,
            entity,
            Map.class
        );
    }
}
