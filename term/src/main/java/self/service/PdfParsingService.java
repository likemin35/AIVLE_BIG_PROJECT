package self.service;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;

@Service
public class PdfParsingService { // (Note: Handles PDF, DOC, DOCX)

    /**
     * MultipartFile에서 텍스트를 추출합니다. 지원되는 파일 형식(PDF, DOC, DOCX)의 내용을 파싱합니다.
     * @param file 추출할 파일
     * @return 추출된 텍스트 또는 빈 문자열
     */
    public String parseContent(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return "";
        }

        String contentType = file.getContentType();
        if (contentType == null) {
            return "";
        }

        try (InputStream inputStream = file.getInputStream()) {
            switch (contentType) {
                case "application/pdf":
                    return parsePdf(inputStream);
                case "application/msword":
                    return parseDoc(inputStream);
                case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                    return parseDocx(inputStream);
                default:
                    // 지원하지 않는 파일 타입
                    return "";
            }
        } catch (IOException e) {
            System.err.println("파일 파싱 중 오류 발생: " + e.getMessage());
            return "";
        }
    }

    private String parsePdf(InputStream inputStream) throws IOException {
        try (PDDocument document = PDDocument.load(inputStream)) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        }
    }

    private String parseDoc(InputStream inputStream) throws IOException {
        try (WordExtractor extractor = new WordExtractor(inputStream)) {
            return extractor.getText();
        }
    }

    private String parseDocx(InputStream inputStream) throws IOException {
        try (XWPFDocument document = new XWPFDocument(inputStream);
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            return extractor.getText();
        }
    }
}