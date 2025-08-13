package self.domain;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Term {

    // Firestore 문서 ID를 저장할 필드
    // @Id 어노테이션 대신 사용
    private String id;

    private String userId;
    private String title;
    private String category;
    private String productName;
    private String content;
    private String requirement;
    private String version;
    private String memo;
    private String origin;
    private Date createdAt;
    private Date modifiedAt;
    private Date expiresAt;
    private String risk;
    private String feedback;
    private String client;
    private String userCompany;
    private String langCode;
    private String updateType;
    private String termType;
    private String fileUrl;

    // JPA 관련 어노테이션 및 메소드 제거
    // @PrePersist, @PostPersist, @PostUpdate 등은 Service 레이어에서 처리해야 함

    /*
    // 아래의 비즈니스 로직 및 이벤트 발행 로직은
    // TermService 클래스로 이동해야 합니다.

    public static TermRepository repository() {
        // ...
    }

    public void foreinTermCreateRequest(ForeinTermCreateRequestCommand command) {
        // ...
    }

    public void riskDectectRequest(RiskDectectRequestCommand command) {
        // ...
    }

    public void termReviewRequest(TermReviewRequestCommand command) {
        // ...
    }

    public void aiTermModifyRequest(AiTermModifyRequestCommand command) {
        // ...
    }

    public void visualizationRequest(VisualizationRequestCommand command) {
        // ...
    }

    public static void registerTerm(TermCreated termCreated) {
        // ...
    }

    public static void registerTerm(ForeignTermCreated foreignTermCreated) {
        // ...
    }

    public static void saveAnalysis(RistDetected ristDetected) {
        // ...
    }

    public static void saveAnalysis(TermReviewed termReviewed) {
        // ...
    }

    public static void saveModifiedTerm(AiTermModified aiTermModified) {
        // ...
    }

    public static Term createNewVersionFrom(Term originalTerm) {
        // ...
    }
    */
}
