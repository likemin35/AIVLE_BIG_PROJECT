package self.domain;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TermJob {

    public static final String TYPE_CREATE = "CREATE";
    public static final String TYPE_ANALYZE = "ANALYZE";

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_DONE = "DONE";
    public static final String STATUS_FAILED = "FAILED";

    private String id;
    private String userId;
    private String type;
    private String status;
    private String termId;
    private String resultId;
    private String errorMessage;
    private String reservationId;
    private Date createdAt;
    private Date updatedAt;
    private Map<String, Object> requestPayload = new HashMap<>();
    private Map<String, Object> resultPayload = new HashMap<>();

    public boolean isTerminal() {
        return STATUS_DONE.equals(status) || STATUS_FAILED.equals(status);
    }
}
