package self.domain;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

@Repository
public class TermRepository {

    private static final String COLLECTION_NAME = "terms";

    @Autowired
    private Firestore firestore;

    public Term save(Term term) throws ExecutionException, InterruptedException {
        if (term.getId() == null || term.getId().isEmpty()) {
            // Create new document
            DocumentReference docRef = firestore.collection(COLLECTION_NAME).document();
            term.setId(docRef.getId());
        }
        firestore.collection(COLLECTION_NAME).document(term.getId()).set(term).get();
        return term;
    }

    public Optional<Term> findById(String id) throws ExecutionException, InterruptedException {
        DocumentReference docRef = firestore.collection(COLLECTION_NAME).document(id);
        ApiFuture<DocumentSnapshot> future = docRef.get();
        DocumentSnapshot document = future.get();
        if (document.exists()) {
            return Optional.ofNullable(document.toObject(Term.class));
        }
        return Optional.empty();
    }

    public void delete(Term term) {
        if (term == null || term.getId() == null) {
            return;
        }
        firestore.collection(COLLECTION_NAME).document(term.getId()).delete();
    }

    public List<Term> findByUserId(String userId) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("userId", userId)
                .get();
        
        List<QueryDocumentSnapshot> documents = future.get().getDocuments();
        return documents.stream()
                .map(doc -> doc.toObject(Term.class))
                .collect(Collectors.toList());
    }

    public List<Term> findByOrigin(String originId) throws ExecutionException, InterruptedException {
        ApiFuture<QuerySnapshot> future = firestore.collection(COLLECTION_NAME)
                .whereEqualTo("origin", originId)
                .get();
        
        List<QueryDocumentSnapshot> documents = future.get().getDocuments();
        return documents.stream()
                .map(doc -> doc.toObject(Term.class))
                .collect(Collectors.toList());
    }

    // 기존 getTerm 메소드를 Firestore 쿼리로 대체 (페이징은 복잡하여 일단 제외)
    public List<Term> getTerm(String id, String userId) throws ExecutionException, InterruptedException {
        CollectionReference termsRef = firestore.collection(COLLECTION_NAME);
        Query query = termsRef;

        if (userId != null && !userId.isEmpty()) {
            query = query.whereEqualTo("userId", userId);
        }
        
        // Firestore는 여러 필드에 대한 range/inequality 쿼리에 제약이 많아
        // ID로 특정 문서 하나를 찾는 것은 findById로 처리하는 것이 더 효율적입니다.
        // 여기서는 userId로 필터링하는 기능만 남겨둡니다.
        if (id != null && !id.isEmpty()) {
             // 특정 ID 조회가 필요하면 findById를 사용하도록 유도
             Term term = findById(id).orElse(null);
             return term != null ? List.of(term) : List.of();
        }

        ApiFuture<QuerySnapshot> future = query.get();
        List<QueryDocumentSnapshot> documents = future.get().getDocuments();
        return documents.stream()
                .map(doc -> doc.toObject(Term.class))
                .collect(Collectors.toList());
    }
}