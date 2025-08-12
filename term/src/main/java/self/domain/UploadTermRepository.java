package self.domain;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

@Repository
public class UploadTermRepository {

    private static final String COLLECTION_NAME = "uploadTerms";

    @Autowired
    private Firestore firestore;

    public UploadTerm save(UploadTerm uploadTerm) throws ExecutionException, InterruptedException {
        if (uploadTerm.getId() == null || uploadTerm.getId().isEmpty()) {
            DocumentReference docRef = firestore.collection(COLLECTION_NAME).document();
            uploadTerm.setId(docRef.getId());
        }
        firestore.collection(COLLECTION_NAME).document(uploadTerm.getId()).set(uploadTerm).get();
        return uploadTerm;
    }

    public Optional<UploadTerm> findById(String id) throws ExecutionException, InterruptedException {
        DocumentReference docRef = firestore.collection(COLLECTION_NAME).document(id);
        ApiFuture<DocumentSnapshot> future = docRef.get();
        DocumentSnapshot document = future.get();
        if (document.exists()) {
            return Optional.ofNullable(document.toObject(UploadTerm.class));
        }
        return Optional.empty();
    }

    public void deleteById(String id) {
        firestore.collection(COLLECTION_NAME).document(id).delete();
    }

    public List<UploadTerm> findByUserId(String userId) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("userId", userId)
                .get();

        List<QueryDocumentSnapshot> documents = future.get().getDocuments();
        return documents.stream()
                .map(doc -> doc.toObject(UploadTerm.class))
                .collect(Collectors.toList());
    }
}