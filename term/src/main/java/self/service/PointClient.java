package self.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

import javax.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;

@Service
public class PointClient {

    @Value("${POINT_SERVICE_BASE_URL:http://localhost:8085}")
    private String pointServiceBaseUrl;

    @Value("${INTERNAL_CALLBACK_TOKEN:}")
    private String internalCallbackToken;

    @Value("${POINT_SERVICE_CONNECT_TIMEOUT_MS:3000}")
    private int connectTimeoutMs;

    @Value("${POINT_SERVICE_READ_TIMEOUT_MS:10000}")
    private int readTimeoutMs;

    private RestTemplate restTemplate;

    @PostConstruct
    void init() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    public Map<String, Object> reserve(String reservationId, String userId, int amount, String description) {
        String url = pointServiceBaseUrl + "/api/points/internal/reservations";
        Map<String, Object> body = new HashMap<>();
        body.put("reservationId", reservationId);
        body.put("userId", userId);
        body.put("amount", amount);
        body.put("description", description);
        return exchange(url, HttpMethod.POST, body);
    }

    public Map<String, Object> confirm(String reservationId) {
        String url = pointServiceBaseUrl + "/api/points/internal/reservations/" + reservationId + "/confirm";
        return exchange(url, HttpMethod.POST, new HashMap<>());
    }

    public Map<String, Object> cancel(String reservationId) {
        String url = pointServiceBaseUrl + "/api/points/internal/reservations/" + reservationId + "/cancel";
        return exchange(url, HttpMethod.POST, new HashMap<>());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> exchange(String url, HttpMethod method, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (internalCallbackToken != null && !internalCallbackToken.isBlank()) {
            headers.setBearerAuth(internalCallbackToken);
        }
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        ResponseEntity<Map> response = restTemplate.exchange(url, method, entity, Map.class);
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("Point service request failed: " + response.getStatusCode());
        }
        return response.getBody() == null ? new HashMap<>() : response.getBody();
    }
}
