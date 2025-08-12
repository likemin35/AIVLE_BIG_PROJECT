package self.infra;

import com.google.firebase.cloud.StorageClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;
import java.io.IOException;

@RestController
@RequestMapping("/api")
public class UploadController {

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("파일이 비어있습니다.");
        }

        try {
            String bucketName = StorageClient.getInstance().bucket().getName();
            String blobString = "uploads/" + file.getOriginalFilename();

            StorageClient.getInstance()
                    .bucket(bucketName)
                    .create(blobString, file.getBytes(), file.getContentType());

            return ResponseEntity.ok(Map.of(
                    "message", "파일 업로드 성공: " + file.getOriginalFilename()
            ));
        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("파일 업로드 중 오류가 발생했습니다.");
        }
    }
}
