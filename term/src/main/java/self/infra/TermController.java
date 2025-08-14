package self.infra;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import self.domain.*;
import self.service.PdfParsingService;
import self.service.TermService;
import org.springframework.web.multipart.MultipartFile;
import com.google.cloud.storage.Bucket;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.Blob;
import com.google.cloud.storage.BlobInfo;

import com.google.firebase.cloud.StorageClient;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import org.springframework.beans.factory.annotation.Value;

@RestController
@RequestMapping("/terms")
public class TermController {
    @Value("${firebase.storage-bucket}")
    private String storageBucket;

    @Autowired
    private StorageClient storageClient;

    @Autowired
    private TermService termService;

    @Autowired
    private PdfParsingService pdfParsingService;

    @Autowired
    private FirebaseAuth firebaseAuth;

    private String getUidFromToken(String authorizationHeader) throws FirebaseAuthException {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Invalid Firebase ID token");
        }
        String token = authorizationHeader.substring(7);
        FirebaseToken decodedToken = firebaseAuth.verifyIdToken(token);
        return decodedToken.getUid();
    }

    @PostMapping
    public ResponseEntity<?> createTerm(@RequestBody TermCreateRequestCommand createCommand,
                                        @RequestHeader("Authorization") String authorizationHeader) {
        try {
            String userId = getUidFromToken(authorizationHeader);
            System.out.println("##### /terms POST called for user: " + userId + " #####");

            Term term = new Term();
            term.setUserId(userId);
            term.setTitle(createCommand.getTitle());
            term.setContent(createCommand.getContent());
            term.setCategory(createCommand.getCategory());
            term.setProductName(createCommand.getProductName());
            term.setRequirement(createCommand.getRequirement());
            term.setUserCompany(createCommand.getUserCompany());
            term.setClient(createCommand.getClient());
            term.setTermType(createCommand.getTermType());
            term.setMemo(createCommand.getMemo()); // 수정 메모 설정
            term.setVersion("v1");

            Term createdTerm = termService.createTerm(term);
            return ResponseEntity.status(HttpStatus.CREATED).body(createdTerm);
        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Failed to verify Firebase ID token: " + e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error creating term: " + e.getMessage());
        }
    }



    @GetMapping
    public ResponseEntity<?> getTermsByUserId(@RequestHeader("Authorization") String authorizationHeader) {
        try {
            String userId = getUidFromToken(authorizationHeader);
            System.out.println("##### /terms GET called for user: " + userId + " #####");
            List<Term> terms = termService.findAllByUserId(userId);
            return ResponseEntity.ok(terms);
        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Failed to verify Firebase ID token: " + e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error fetching terms: " + e.getMessage());
        }
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getTermById(@PathVariable String id, @RequestHeader("Authorization") String authorizationHeader) {
        try {
            String userId = getUidFromToken(authorizationHeader);
            Optional<Term> termOptional = termService.findById(id);

            if (termOptional.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Term not found with id: " + id);
            }

            Term term = termOptional.get();
            if (!term.getUserId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("User does not have permission to access this term.");
            }

            return ResponseEntity.ok(term);
        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Token verification failed: " + e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error fetching term: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTerm(@PathVariable String id,
                                        @RequestParam String type,
                                        @RequestHeader("Authorization") String authorizationHeader) {
        try {
            String userId = getUidFromToken(authorizationHeader);
            Optional<Term> termOptional = termService.findById(id);

            if (termOptional.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body("Term not found with id: " + id);
            }

            Term term = termOptional.get();
            if (!term.getUserId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("User does not have permission to delete this term.");
            }

            if ("latest".equals(type)) {
                termService.deleteLatestVersion(id);
                return ResponseEntity.ok().body("Latest version deleted successfully.");
            } else if ("group".equals(type)) {
                termService.deleteTermGroup(id);
                return ResponseEntity.ok().body("Term group deleted successfully.");
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid delete type specified.");
            }

        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Token verification failed: " + e.getMessage());
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Error deleting term: " + e.getMessage());
        }
    }

    @PostMapping("/{id}/foreintermcreaterequest")
    public ResponseEntity<?> foreinTermCreateRequest(@PathVariable String id,
                                                     @RequestBody ForeinTermCreateRequestCommand command,
                                                     @RequestHeader("Authorization") String authorizationHeader) {
        try {
            String userId = getUidFromToken(authorizationHeader);
            Term originalTerm = termService.findById(id)
                    .orElseThrow(() -> new Exception("Original term not found"));

            if (!originalTerm.getUserId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("User does not have permission for this term");
            }
            
            // TODO: foreinTermCreateRequest 로직을 TermService로 이동해야 함
            // originalTerm.foreinTermCreateRequest(command);
            // termService.save(originalTerm);

            return ResponseEntity.ok(originalTerm);
        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Token verification failed: " + e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @PostMapping("/{id}/ai-modify")
    public ResponseEntity<?> aiTermModifyRequest(@PathVariable String id,
                                                 @RequestBody AiTermModifyRequestCommand command,
                                                 @RequestHeader("Authorization") String authorizationHeader) {
        try {
            String userId = getUidFromToken(authorizationHeader);
            Term originalTerm = termService.findById(id)
                    .orElseThrow(() -> new Exception("Original term not found"));

            if (!originalTerm.getUserId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("User does not have permission to modify this term");
            }

            Term newVersionTerm = termService.createNewVersionFrom(originalTerm);
            newVersionTerm.setUpdateType("AI_MODIFY");
            newVersionTerm.setModifiedAt(new Date());
            
            // TODO: aiTermModifyRequest 로직을 TermService로 이동해야 함
            
            termService.save(newVersionTerm);
            return ResponseEntity.ok(newVersionTerm);
        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Token verification failed: " + e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @PutMapping("/{id}/direct-update")
    public ResponseEntity<?> directUpdateTerm(@PathVariable String id,
                                              @RequestBody TermDirectUpdateRequestCommand command,
                                              @RequestHeader("Authorization") String authorizationHeader) {
        try {
            String userId = getUidFromToken(authorizationHeader);
            Term originalTerm = termService.findById(id)
                    .orElseThrow(() -> new Exception("Original term not found"));

            if (!originalTerm.getUserId().equals(userId)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("User does not have permission to modify this term");
            }

            Term newVersionTerm = termService.createNewVersionFrom(originalTerm);
            newVersionTerm.setUpdateType("DIRECT_UPDATE");
            newVersionTerm.setModifiedAt(new Date());
            newVersionTerm.setTitle(command.getTitle());
            newVersionTerm.setContent(command.getContent());
            newVersionTerm.setMemo(command.getMemo());
            
            termService.save(newVersionTerm);
            return ResponseEntity.ok(newVersionTerm);
        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Token verification failed: " + e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadTerm(
            @RequestParam("file") MultipartFile file,
            @RequestHeader("Authorization") String authorizationHeader) {
        try {
            String userId = getUidFromToken(authorizationHeader);
            String originalFileName = file.getOriginalFilename();

            // 파일명에서 확장자 제거하여 제목으로 사용
            String title = originalFileName;
            if (originalFileName != null && originalFileName.contains(".")) {
                title = originalFileName.substring(0, originalFileName.lastIndexOf('.'));
            }

            // PDF 및 Word 파일로부터 텍스트 내용 추출
            String content = pdfParsingService.parseContent(file);

            // 사용자별 디렉토리를 포함한 고유 파일 경로 생성
            String blobPath = "uploads/" + userId + "/" + System.currentTimeMillis() + "_" + originalFileName;

            // 다운로드 시 원본 파일명을 제안하도록 Content-Disposition 메타데이터 설정
            // 파일명에 쌍따옴표가 포함될 경우를 대비해 안전한 문자로 치환
            String sanitizedFileName = originalFileName.replace("\"", "'" );
            BlobInfo blobInfo = BlobInfo.newBuilder(storageBucket, blobPath)
                .setContentType(file.getContentType())
                .setContentDisposition("attachment; filename=\"" + sanitizedFileName + "\"")
                .build();

            // StorageClient를 통해 파일과 메타데이터를 함께 업로드
            // Bucket 객체에서 Storage 객체를 가져와야 BlobInfo를 사용하는 create 메소드를 호출할 수 있음
            Storage storage = storageClient.bucket().getStorage();
            Blob blob = storage.create(blobInfo, file.getBytes());

            // 공개 URL 생성 (URL 인코딩 필요)
            String fileUrl = String.format("https://firebasestorage.googleapis.com/v0/b/%s/o/%s?alt=media",
                    storageBucket, java.net.URLEncoder.encode(blobPath, "UTF-8"));

            // Term 객체 생성 및 저장
            Term term = new Term();
            term.setUserId(userId);
            term.setTitle(title); // 확장자가 제거된 제목 저장
            term.setContent(content);
            term.setFileUrl(fileUrl);
            term.setTermType("UPLOADED");
            term.setVersion("v1");
            term.setCreatedAt(new Date());

            Term savedTerm = termService.createTerm(term);

            return ResponseEntity.status(HttpStatus.CREATED).body(savedTerm);

        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body("Failed to verify Firebase ID token: " + e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error uploading term: " + e.getMessage());
        }
    }
}
