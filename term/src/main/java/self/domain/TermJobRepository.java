package self.domain;

import com.google.api.core.ApiFuture;
import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.concurrent.ExecutionException;

@Repository
public class TermJobRepository {

    private static final String COLLECTION_NAME = "termJobs";

    @Autowired
    private Firestore firestore;

    public TermJob save(TermJob job) throws ExecutionException, InterruptedException {
        if (job.getId() == null || job.getId().isEmpty()) {
            DocumentReference ref = firestore.collection(COLLECTION_NAME).document();
            job.setId(ref.getId());
        }
        firestore.collection(COLLECTION_NAME).document(job.getId()).set(job).get();
        return job;
    }

    public Optional<TermJob> findById(String id) throws ExecutionException, InterruptedException {
        ApiFuture<DocumentSnapshot> future = firestore.collection(COLLECTION_NAME).document(id).get();
        DocumentSnapshot snapshot = future.get();
        if (!snapshot.exists()) {
            return Optional.empty();
        }
        return Optional.ofNullable(snapshot.toObject(TermJob.class));
    }
}
