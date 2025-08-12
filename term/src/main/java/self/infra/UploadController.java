package self.infra;

import com.google.cloud.firestore.Firestore;
import com.google.firebase.cloud.StorageClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import self.domain.UploadTerm;

import java.io.IOException;
import java.util.Date;
import java.util.Map;
import java.util.concurrent.ExecutionException;

@RestController
@RequestMapping("/api")
public class UploadController {

    private final StorageClient storageClient;
    private final Firestore firestore;

    @Autowired
    public UploadController(StorageClient storageClient, Firestore firestore) {
        this.storageClient = storageClient;
        this.firestore = firestore;
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(
            @RequestParam("file") MultipartFile file,
            @RequestParam("uploaderUid") String uploaderUid 
    ) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "파일이 비어있습니다."));
        }

        try {
            // 1. Storage 업로드 (메타데이터 포함)
            String bucketName = storageClient.bucket().getName();
            String blobString = "uploads/" + file.getOriginalFilename();

            Map<String, String> metadata = Map.of("uploaderUid", uploaderUid);

            storageClient.bucket(bucketName)
                    .create(blobString, file.getBytes(), file.getContentType())
                    .toBuilder()
                    .setMetadata(metadata)
                    .build()
                    .update();

            // 2. 다운로드 URL 생성
            String fileUrl = String.format("https://storage.googleapis.com/%s/%s", bucketName, blobString);

            // 3. UploadTerm 객체 생성
            UploadTerm uploadTerm = new UploadTerm();
            uploadTerm.setUserId(uploaderUid);
            uploadTerm.setFileName(file.getOriginalFilename());
            uploadTerm.setFileUrl(fileUrl);
            uploadTerm.setCreatedAt(new Date());

            // 4. Firestore에 저장
            firestore.collection("uploadTerms").add(uploadTerm).get();

            return ResponseEntity.ok(Map.of(
                    "message", "파일 업로드 및 Firestore 저장 성공",
                    "fileName", file.getOriginalFilename(),
                    "fileUrl", fileUrl
            ));

        } catch (IOException | ExecutionException | InterruptedException e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("message", "파일 업로드 중 오류 발생"));
        }
    }
}
