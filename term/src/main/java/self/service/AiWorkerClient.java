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
public class AiWorkerClient {

    @Value("${CREATE_SERVICE_BASE_URL:http://localhost:8080}")
    private String createServiceBaseUrl;

    @Value("${ANALYZE_SERVICE_BASE_URL:http://localhost:8082}")
    private String analyzeServiceBaseUrl;

    @Value("${INTERNAL_CALLBACK_TOKEN:}")
    private String internalCallbackToken;

    @Value("${AI_WORKER_CONNECT_TIMEOUT_MS:3000}")
    private int connectTimeoutMs;

    @Value("${AI_WORKER_READ_TIMEOUT_MS:15000}")
    private int readTimeoutMs;

    private RestTemplate restTemplate;

    @PostConstruct
    void init() {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutMs);
        requestFactory.setReadTimeout(readTimeoutMs);
        this.restTemplate = new RestTemplate(requestFactory);
    }

    public void dispatchCreate(Map<String, Object> payload) {
        postPubSubEnvelope(createServiceBaseUrl + "/internal/pubsub/terms-create", payload);
    }

    public void dispatchAnalyze(Map<String, Object> payload) {
        postPubSubEnvelope(analyzeServiceBaseUrl + "/internal/pubsub/terms-analyze", payload);
    }

    private void postPubSubEnvelope(String url, Map<String, Object> payload) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (internalCallbackToken != null && !internalCallbackToken.isBlank()) {
            headers.setBearerAuth(internalCallbackToken);
        }

        Map<String, Object> message = new HashMap<>();
        message.put("data", java.util.Base64.getEncoder().encodeToString(toJson(payload).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        Map<String, Object> envelope = new HashMap<>();
        envelope.put("message", message);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(envelope, headers);
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
        if (!response.getStatusCode().is2xxSuccessful()) {
            throw new IllegalStateException("AI worker dispatch failed: " + response.getStatusCode());
        }
    }

    private String toJson(Map<String, Object> payload) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize payload", e);
        }
    }
}
