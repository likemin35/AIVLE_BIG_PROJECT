package self.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.api.core.ApiFuture;
import com.google.cloud.pubsub.v1.Publisher;
import com.google.protobuf.ByteString;
import com.google.pubsub.v1.ProjectTopicName;
import com.google.pubsub.v1.PubsubMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@Service
public class PubSubPublisherService {

    private final ObjectMapper objectMapper;

    @Value("${GCP_PROJECT_ID:aivle-team0721}")
    private String gcpProjectId;

    public PubSubPublisherService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String publishJson(String topicId, Map<String, Object> payload)
        throws IOException, ExecutionException, InterruptedException {
        ProjectTopicName topicName = ProjectTopicName.of(gcpProjectId, topicId);
        Publisher publisher = Publisher.newBuilder(topicName).build();
        try {
            byte[] body = objectMapper.writeValueAsBytes(payload);
            PubsubMessage message = PubsubMessage.newBuilder()
                .setData(ByteString.copyFrom(body))
                .build();
            ApiFuture<String> future = publisher.publish(message);
            return future.get();
        } finally {
            publisher.shutdown();
        }
    }

    public String serializePayload(Map<String, Object> payload) throws IOException {
        return objectMapper.writeValueAsString(payload);
    }
}
