package self.infra;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.CollectionReference;
import com.google.cloud.firestore.Query;
import com.google.cloud.firestore.QueryDocumentSnapshot;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.firebase.cloud.StorageClient;
import com.google.cloud.firestore.Firestore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import self.domain.UploadTerm;

import java.io.IOException;
import java.util.UUID;
import java.util.*;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

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
            // 1. 고유 파일 경로 생성
            String originalFileName = file.getOriginalFilename();
            String uniqueFileName = UUID.randomUUID().toString() + "-" + originalFileName;
            String blobString = "uploads/" + uploaderUid + "/" + uniqueFileName;
            
            // 2. Storage 업로드 (메타데이터 포함)
            String bucketName = storageClient.bucket().getName();
            Map<String, String> metadata = Map.of("uploaderUid", uploaderUid);

            storageClient.bucket(bucketName)
                    .create(blobString, file.getBytes(), file.getContentType())
                    .toBuilder()
                    .setMetadata(metadata)
                    .build()
                    .update();

            // 3. 다운로드 URL 생성
            String fileUrl = String.format("https://storage.googleapis.com/%s/%s", bucketName, blobString);

            // 4. UploadTerm 객체 생성
            UploadTerm uploadTerm = new UploadTerm();
            uploadTerm.setUserId(uploaderUid);
            uploadTerm.setFileName(originalFileName); // Firestore에는 원본 파일명 저장
            uploadTerm.setFileUrl(fileUrl);
            uploadTerm.setCreatedAt(new Date());
            uploadTerm.setVersion("1");
            String version = "1";

            // 5. Firestore에 저장
            firestore.collection("uploadTerms").add(uploadTerm).get();

            return ResponseEntity.ok(Map.of(
                    "message", "파일 업로드 성공",
                    "fileName", originalFileName,
                    "fileUrl", fileUrl,
                    "version", version
            ));

        } catch (IOException | ExecutionException | InterruptedException e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("message", "파일 업로드 중 오류 발생"));
        }
    }
    /**
     * 파일명에서 버전 숫자를 추출하는 헬퍼 메서드
     */
    private int extractVersionFromFileName(String fileName) {
        if (fileName == null) return 0;
        // v1, ver2, V3, VER10 등 다양한 케이스 허용
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile("v(?:er)?(\\d+)", java.util.regex.Pattern.CASE_INSENSITIVE);
        java.util.regex.Matcher matcher = pattern.matcher(fileName);
        if (matcher.find()) {
            try {
                return Integer.parseInt(matcher.group(1));
            } catch (NumberFormatException e) {
                return 0;
            }
        }
        return 0;  // 버전 정보 없으면 0 반환
    }

    
}
