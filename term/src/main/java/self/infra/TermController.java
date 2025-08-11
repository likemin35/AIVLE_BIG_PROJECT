package self.infra;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import self.domain.*;
import self.service.TermService;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/terms")
public class TermController {

    @Autowired
    private TermService termService;

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
}