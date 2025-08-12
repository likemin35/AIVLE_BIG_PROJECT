package self.infra;

import com.google.firebase.cloud.StorageClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = {
    "http://localhost:3000", 
    "http://34.54.82.32"  
})
public class UploadController {

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("파일이 비어있습니다.");
        }

        try {
            // Firebase 스토리지에 업로드
            String bucketName = StorageClient.getInstance().bucket().getName();

            // 경로 지정 (예: uploads/파일명)
            String blobString = "uploads/" + file.getOriginalFilename();

            // 업로드
            StorageClient.getInstance()
                    .bucket(bucketName)
                    .create(blobString, file.getBytes(), file.getContentType());

            return ResponseEntity.ok().body("파일 업로드 성공: " + file.getOriginalFilename());
        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("파일 업로드 중 오류가 발생했습니다.");
        }
    }
}
