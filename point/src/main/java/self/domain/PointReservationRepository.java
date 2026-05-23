package self.domain;

import org.springframework.cloud.gcp.data.firestore.FirestoreReactiveRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PointReservationRepository extends FirestoreReactiveRepository<PointReservation> {
}
