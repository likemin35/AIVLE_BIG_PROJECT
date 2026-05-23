package self.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertTrue;

class PubSubPublisherServiceTest {

    @Test
    void serializePayload_containsExpectedFields() throws Exception {
        PubSubPublisherService publisherService = new PubSubPublisherService(new ObjectMapper());
        Map<String, Object> payload = new HashMap<>();
        payload.put("jobId", "job-123");
        payload.put("userId", "user-123");
        payload.put("type", "CREATE");

        String json = publisherService.serializePayload(payload);

        assertTrue(json.contains("\"jobId\":\"job-123\""));
        assertTrue(json.contains("\"userId\":\"user-123\""));
        assertTrue(json.contains("\"type\":\"CREATE\""));
    }
}
