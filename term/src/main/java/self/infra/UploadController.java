package self.infra;

import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import com.google.firebase.cloud.StorageClient;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class UploadController {

    private final Storage storage;

    public UploadController() {
        // Firebase 기본 Storage 인스턴스 가져오기
        this.storage = StorageClient.getInstance().bucket().getStorage();
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("uid") String uploaderUid // 업로더 UID 추가 파라미터
    ) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "파일이 비어있습니다."));
        }

        try {
            String bucketName = StorageClient.getInstance().bucket().getName();
            String blobName = "uploads/" + file.getOriginalFilename();

            // BlobInfo 생성 시 메타데이터에 업로더 UID 포함
            BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, blobName)
                    .setContentType(file.getContentType())
                    .setMetadata(Map.of("uploaderUid", uploaderUid))
                    .build();

            // Storage API를 사용해 업로드
            storage.create(blobInfo, file.getBytes());

            return ResponseEntity.ok(Map.of(
                    "message", "파일 업로드 성공: " + file.getOriginalFilename(),
                    "uploaderUid", uploaderUid
            ));
        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("message", "파일 업로드 중 오류가 발생했습니다."));
        }
    }
}
