package self.service;

import com.google.cloud.storage.Blob;
import com.google.cloud.storage.Bucket;
import com.google.firebase.cloud.StorageClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import self.domain.Term;
import self.domain.TermRepository;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutionException;

@Service
public class TermService {

    @Autowired
    private TermRepository termRepository;

    @Autowired
    private StorageClient storageClient;

    private void deleteFileFromStorage(String fileUrl) {
        if (fileUrl == null || fileUrl.isEmpty()) {
            return;
        }

        try {
            String pathPart = fileUrl.split("[?]")[0];
            int startIndex = pathPart.indexOf("/o/");
            if (startIndex == -1) {
                return;
            }

            String encodedPath = pathPart.substring(startIndex + 3);
            String blobPath = URLDecoder.decode(encodedPath, StandardCharsets.UTF_8.name());

            Bucket bucket = storageClient.bucket();
            Blob blob = bucket.get(blobPath);

            if (blob != null && blob.exists()) {
                blob.delete();
                System.out.println("Successfully deleted from Storage: " + blobPath);
            }
        } catch (Exception e) {
            System.err.println("Failed to delete file from Storage: " + fileUrl);
            e.printStackTrace();
        }
    }

    public Term createTerm(Term term) throws ExecutionException, InterruptedException {
        term.setCreatedAt(new Date());
        return save(term);
    }

    public Optional<Term> findById(String id) throws ExecutionException, InterruptedException {
        return termRepository.findById(id);
    }

    public List<Term> findAllByUserId(String userId) throws ExecutionException, InterruptedException {
        return termRepository.findByUserId(userId);
    }

    public Term save(Term term) throws ExecutionException, InterruptedException {
        termRepository.save(term);
        return term;
    }

    public void deleteLatestVersion(String id) throws ExecutionException, InterruptedException {
        Optional<Term> termOptional = termRepository.findById(id);
        if (termOptional.isPresent()) {
            Term termToDelete = termOptional.get();

            List<Term> children = termRepository.findByOrigin(termToDelete.getId());
            if (!children.isEmpty()) {
                throw new IllegalStateException("Cannot delete a version that is an origin for another version.");
            }

            deleteFileFromStorage(termToDelete.getFileUrl());
            termRepository.delete(termToDelete);
        }
    }

    public void deleteTermGroup(String id) throws ExecutionException, InterruptedException {
        Optional<Term> termOptional = termRepository.findById(id);
        if (termOptional.isEmpty()) {
            return;
        }
        Term currentTerm = termOptional.get();

        Term rootTerm = currentTerm;
        while (rootTerm.getOrigin() != null) {
            Optional<Term> parentOptional = termRepository.findById(rootTerm.getOrigin());
            if (parentOptional.isEmpty()) {
                break;
            }
            rootTerm = parentOptional.get();
        }

        List<Term> allVersions = new ArrayList<>();
        findAllVersionsRecursive(rootTerm, allVersions);

        for (Term term : allVersions) {
            deleteFileFromStorage(term.getFileUrl());
            termRepository.delete(term);
        }
    }

    private void findAllVersionsRecursive(Term term, List<Term> allVersions) throws ExecutionException, InterruptedException {
        allVersions.add(term);
        List<Term> children = termRepository.findByOrigin(term.getId());
        for (Term child : children) {
            findAllVersionsRecursive(child, allVersions);
        }
    }

    public Term createNewVersionFrom(Term originalTerm) {
        if (originalTerm == null) {
            throw new IllegalArgumentException("Original term cannot be null");
        }
        Term newVersionTerm = new Term();
        newVersionTerm.setUserId(originalTerm.getUserId());
        newVersionTerm.setTitle(originalTerm.getTitle());
        newVersionTerm.setContent(originalTerm.getContent());
        newVersionTerm.setCategory(originalTerm.getCategory());
        newVersionTerm.setProductName(originalTerm.getProductName());
        newVersionTerm.setRequirement(originalTerm.getRequirement());
        newVersionTerm.setUserCompany(originalTerm.getUserCompany());
        newVersionTerm.setClient(originalTerm.getClient());
        newVersionTerm.setCreatedAt(originalTerm.getCreatedAt());

        int currentVersion = Integer.parseInt(originalTerm.getVersion().replace("v", ""));
        newVersionTerm.setVersion("v" + (currentVersion + 1));
        newVersionTerm.setOrigin(originalTerm.getId());

        return newVersionTerm;
    }

    public String uploadFileAndGetUrl(MultipartFile file) throws IOException {
        Bucket bucket = StorageClient.getInstance().bucket();
        String fileName = java.util.UUID.randomUUID() + "_" + file.getOriginalFilename();
        bucket.create(fileName, file.getBytes(), file.getContentType());
        return String.format("https://storage.googleapis.com/%s/%s", bucket.getName(), fileName);
    }
}
