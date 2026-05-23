package self.domain;

import com.google.cloud.firestore.annotation.DocumentId;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import org.springframework.cloud.gcp.data.firestore.Document;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collectionName = "points") // Firestore의 "points" 컬렉션과 매핑
public class Point {

    @DocumentId // 이 필드가 Firestore 문서의 ID임을 명시
    private String id;

    private Integer amount;

    private String userId; // Firebase UID

    private Integer reservedAmount;
}
