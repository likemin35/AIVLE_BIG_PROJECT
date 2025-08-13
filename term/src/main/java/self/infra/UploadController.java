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
            uploadTerm.setVersion("1");
            String version = "1";

            // 4. Firestore에 저장
            firestore.collection("uploadTerms").add(uploadTerm).get();

            return ResponseEntity.ok(Map.of(
                    "message", "파일 업로드 성공",
                    "fileName", file.getOriginalFilename(),
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

    /**
     * GET /api/upload-terms?userId={uid}
     * 특정 사용자(uploaderUid)로 업로드된 약관 목록 조회
     */
    @GetMapping("/upload-terms")
    public ResponseEntity<?> getUploadTerms(@RequestParam("userId") String userId) {
        try {
            CollectionReference uploadTermsRef = firestore.collection("uploadTerms");
            Query query = uploadTermsRef.whereEqualTo("userId", userId);
            ApiFuture<QuerySnapshot> querySnapshot = query.get();

            List<UploadTerm> uploadTerms = new ArrayList<>();
            for (QueryDocumentSnapshot document : querySnapshot.get().getDocuments()) {
                UploadTerm uploadTerm = document.toObject(UploadTerm.class);
                uploadTerm.setId(document.getId()); // 문서 ID 설정 (필요시)
                uploadTerms.add(uploadTerm);
            }

            return ResponseEntity.ok(uploadTerms);

        } catch (InterruptedException | ExecutionException e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("message", "업로드 약관 조회 중 오류 발생"));
        }
    }
}
