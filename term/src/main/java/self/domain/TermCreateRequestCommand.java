package self.domain;

import lombok.Data;

@Data
public class TermCreateRequestCommand {
    private String title;
    private String content;
    private String category;
    private String productName;
    private String requirement;
    private String userCompany;
    private String client;
    private String termType;
    private String memo;
}