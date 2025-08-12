package self.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import self.domain.UploadTerm;
import self.domain.UploadTermRepository;
import java.util.concurrent.ExecutionException;
import java.util.Date;

@Service
public class UploadTermService {

    @Autowired
    private UploadTermRepository uploadTermRepository;

    public UploadTerm save(UploadTerm uploadTerm) throws ExecutionException, InterruptedException {
        uploadTerm.setCreatedAt(new Date());
        return uploadTermRepository.save(uploadTerm);
    }
}