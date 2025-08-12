package self.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.secretmanager.v1.SecretManagerServiceClient;
import com.google.cloud.secretmanager.v1.SecretVersionName;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.cloud.FirestoreClient;
import com.google.firebase.cloud.StorageClient; // StorageClient import
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.annotation.PostConstruct; // PostConstruct import
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

@Configuration
public class FirebaseConfig {

    @Value("${firebase.secret-id}")
    private String secretId;

    @Value("${firebase.project-id}")
    private String projectId;

    // storage-bucket 값을 yml에서 주입받음
    @Value("${firebase.storage-bucket}")
    private String storageBucket;

    // Bean 대신 PostConstruct로 변경하여 애플리케이션 시작 시 초기화
    @PostConstruct
    public void initFirebase() throws IOException {
        if (FirebaseApp.getApps().isEmpty()) {
            try (SecretManagerServiceClient client = SecretManagerServiceClient.create()) {
                SecretVersionName secretVersionName = SecretVersionName.of(projectId, secretId, "latest");
                String secretPayload = client.accessSecretVersion(secretVersionName).getPayload().getData().toStringUtf8();
                InputStream serviceAccount = new ByteArrayInputStream(secretPayload.getBytes(StandardCharsets.UTF_8));

                FirebaseOptions options = new FirebaseOptions.Builder()
                        .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                        .setProjectId(projectId)
                        .setStorageBucket(storageBucket) // 주입받은 스토리지 버킷 설정
                        .build();

                FirebaseApp.initializeApp(options);
            }
        }
    }

    // Firestore와 FirebaseAuth는 Bean으로 등록하여 필요 시 주입받아 사용
    @Bean
    public Firestore firestore() {
        return FirestoreClient.getFirestore();
    }

    @Bean
    public FirebaseAuth firebaseAuth() {
        return FirebaseAuth.getInstance();
    }

    // StorageClient를 Bean으로 등록
    @Bean
    public StorageClient storageClient() {
        return StorageClient.getInstance();
    }
}