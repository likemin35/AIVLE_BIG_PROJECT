package self.infra;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import self.domain.Term;
import self.domain.TermJob;
import self.service.AsyncAiJobService;
import self.service.PdfParsingService;
import self.service.TermService;

import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/terms")
public class TermJobController {

    private final AsyncAiJobService asyncAiJobService;
    private final TermService termService;
    private final FirebaseAuth firebaseAuth;
    private final PdfParsingService pdfParsingService;

    @Value("${INTERNAL_CALLBACK_TOKEN:}")
    private String internalCallbackToken;

    public TermJobController(
        AsyncAiJobService asyncAiJobService,
        TermService termService,
        FirebaseAuth firebaseAuth,
        PdfParsingService pdfParsingService
    ) {
        this.asyncAiJobService = asyncAiJobService;
        this.termService = termService;
        this.firebaseAuth = firebaseAuth;
        this.pdfParsingService = pdfParsingService;
    }

    @PostMapping("/jobs/create")
    public ResponseEntity<?> requestCreateJob(
        @RequestParam("productMeta") MultipartFile productMeta,
        @RequestParam(value = "companyName", required = false) String companyName,
        @RequestParam("category") String category,
        @RequestParam(value = "productName", required = false) String productName,
        @RequestParam(value = "effectiveDate", required = false) String effectiveDate,
        @RequestParam(value = "requirements", required = false) String requirements,
        @RequestHeader("Authorization") String authorizationHeader
    ) {
        try {
            String userId = getUidFromToken(authorizationHeader);
            TermJob job = asyncAiJobService.createCreateJob(
                userId,
                companyName,
                category,
                productName,
                effectiveDate,
                requirements,
                productMeta.getBytes(),
                productMeta.getOriginalFilename(),
                productMeta.getContentType()
            );
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(toJobResponse(job));
        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error("Token verification failed: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error("Failed to create async create job: " + e.getMessage()));
        }
    }

    @PostMapping("/{termId}/jobs/analyze")
    public ResponseEntity<?> requestAnalyzeJob(
        @PathVariable String termId,
        @RequestBody AnalyzeJobRequest request,
        @RequestHeader("Authorization") String authorizationHeader
    ) {
        try {
            String userId = getUidFromToken(authorizationHeader);
            Term term = termService.findById(termId)
                .orElseThrow(() -> new IllegalArgumentException("Term not found: " + termId));
            if (!userId.equals(term.getUserId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error("User does not have permission to analyze this term."));
            }
            TermJob job = asyncAiJobService.createAnalyzeJob(userId, termId, request.getCategory());
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(toJobResponse(job));
        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error("Token verification failed: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error("Failed to create async analyze job: " + e.getMessage()));
        }
    }

    @PostMapping("/jobs/analyze-file")
    public ResponseEntity<?> requestAnalyzeFileJob(
        @RequestParam("file") MultipartFile file,
        @RequestParam("category") String category,
        @RequestHeader("Authorization") String authorizationHeader
    ) {
        try {
            String userId = getUidFromToken(authorizationHeader);
            String title = file.getOriginalFilename() == null ? "uploaded-file" : file.getOriginalFilename();
            String text = parseAnalyzeFileContent(file);
            if (text == null || text.isBlank()) {
                return ResponseEntity.badRequest().body(error("Uploaded file content could not be parsed."));
            }
            TermJob job = asyncAiJobService.createAnalyzeTextJob(userId, category, text, title);
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(toJobResponse(job));
        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error("Token verification failed: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error("Failed to create async analyze file job: " + e.getMessage()));
        }
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<?> getJob(
        @PathVariable String jobId,
        @RequestHeader("Authorization") String authorizationHeader
    ) {
        try {
            String userId = getUidFromToken(authorizationHeader);
            TermJob job = asyncAiJobService.getJob(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Job not found: " + jobId));
            if (!userId.equals(job.getUserId())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error("User does not have permission to view this job."));
            }
            return ResponseEntity.ok(toJobResponse(job));
        } catch (FirebaseAuthException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(error("Token verification failed: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error(e.getMessage()));
        }
    }

    @PostMapping("/internal/jobs/{jobId}/complete")
    public ResponseEntity<?> completeJob(
        @PathVariable String jobId,
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
        @RequestBody Map<String, Object> body
    ) {
        try {
            verifyInternalToken(authorizationHeader);
            TermJob job = asyncAiJobService.completeJob(jobId, body);
            return ResponseEntity.ok(toJobResponse(job));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error("Failed to complete job: " + e.getMessage()));
        }
    }

    @PostMapping("/internal/jobs/{jobId}/fail")
    public ResponseEntity<?> failJob(
        @PathVariable String jobId,
        @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
        @RequestBody Map<String, Object> body
    ) {
        try {
            verifyInternalToken(authorizationHeader);
            String errorMessage = body.get("errorMessage") == null ? "Unknown AI worker failure" : String.valueOf(body.get("errorMessage"));
            TermJob job = asyncAiJobService.failJob(jobId, errorMessage);
            return ResponseEntity.ok(toJobResponse(job));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(error("Failed to fail job: " + e.getMessage()));
        }
    }

    private String getUidFromToken(String authorizationHeader) throws FirebaseAuthException {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Invalid Firebase ID token");
        }
        String token = authorizationHeader.substring(7);
        FirebaseToken decodedToken = firebaseAuth.verifyIdToken(token);
        return decodedToken.getUid();
    }

    private void verifyInternalToken(String authorizationHeader) {
        if (!StringUtils.hasText(internalCallbackToken)) {
            return;
        }
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Missing internal bearer token");
        }
        String token = authorizationHeader.substring(7);
        if (!internalCallbackToken.equals(token)) {
            throw new IllegalArgumentException("Invalid internal bearer token");
        }
    }

    private Map<String, Object> toJobResponse(TermJob job) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("jobId", job.getId());
        response.put("type", job.getType());
        response.put("status", job.getStatus());
        response.put("resultId", job.getResultId());
        response.put("errorMessage", job.getErrorMessage());
        response.put("createdAt", job.getCreatedAt());
        response.put("updatedAt", job.getUpdatedAt());
        response.put("result", job.getResultPayload());
        return response;
    }

    private String parseAnalyzeFileContent(MultipartFile file) throws Exception {
        String contentType = file.getContentType();
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        if ("text/plain".equalsIgnoreCase(contentType) || filename.endsWith(".txt")) {
            return new String(file.getBytes(), java.nio.charset.StandardCharsets.UTF_8);
        }
        return pdfParsingService.parseContent(file);
    }

    private Map<String, Object> error(String message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("timestamp", new Date());
        response.put("errorMessage", message);
        return response;
    }

    public static class AnalyzeJobRequest {
        private String category;

        public String getCategory() {
            return category;
        }

        public void setCategory(String category) {
            this.category = category;
        }
    }
}
