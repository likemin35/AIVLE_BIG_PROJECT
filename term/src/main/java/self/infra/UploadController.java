package self.infra;

import com.google.firebase.cloud.StorageClient;
import org.springframework.beans.factory.annotation.Autowired; // Autowired import
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;
import java.io.IOException;

@RestController
@RequestMapping("/api")
public class UploadController {

    // StorageClient를 Bean으로 주입받음
    private final StorageClient storageClient;

    @Autowired
    public UploadController(StorageClient storageClient) {
        this.storageClient = storageClient;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "파일이 비어있습니다."));
        }

        try {
            // 주입받은 storageClient 사용
            String bucketName = storageClient.bucket().getName();
            String blobString = "uploads/" + file.getOriginalFilename();

            storageClient.bucket(bucketName)
                         .create(blobString, file.getBytes(), file.getContentType());

            return ResponseEntity.ok(Map.of(
                    "message", "파일 업로드 성공: " + file.getOriginalFilename()
            ));
        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("message", "파일 업로드 중 오류가 발생했습니다."));
        }
    }
}