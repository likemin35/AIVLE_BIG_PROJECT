package self.domain;

import lombok.Data;
import org.springframework.data.annotation.Id;
import java.util.Date;

@Data
public class UploadTerm {
    @Id
    private String id;            // Firestore 문서 ID
    private String userId;        // 업로더 UID
    private String fileName;      // 파일명
    private String fileUrl;       // Firebase Storage 다운로드 URL
    private Date createdAt;       // 업로드 시간
}