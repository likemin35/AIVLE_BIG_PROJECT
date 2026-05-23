package self.service;

import com.google.cloud.firestore.DocumentReference;
import com.google.cloud.firestore.DocumentSnapshot;
import com.google.cloud.firestore.Firestore;
import com.google.cloud.firestore.QuerySnapshot;
import com.google.cloud.firestore.Transaction;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import self.domain.Point;
import self.domain.PointHistory;
import self.domain.PointHistoryRepository;
import self.domain.PointRepository;
import self.domain.PointReservation;

import java.util.Calendar;
import java.util.Date;

@Service
public class PointService {

    private static final int INITIAL_POINT_AMOUNT = 100000;
    private static final int DAILY_CHARGE_LIMIT = 1000000;
    private static final String POINTS_COLLECTION = "points";
    private static final String RESERVATIONS_COLLECTION = "pointReservations";
    private static final String HISTORIES_COLLECTION = "pointHistories";

    @Autowired
    private PointRepository pointRepository;

    @Autowired
    private PointHistoryRepository pointHistoryRepository;

    @Autowired
    private Firestore firestore;

    public Mono<Point> getOrCreatePoint(String userId) {
        return pointRepository.findByUserId(userId)
            .map(this::normalizePoint)
            .switchIfEmpty(Mono.defer(() -> {
                Point newPoint = new Point();
                newPoint.setUserId(userId);
                newPoint.setAmount(0);
                newPoint.setReservedAmount(0);
                return pointRepository.save(newPoint);
            }));
    }

    public Flux<PointHistory> getPointHistory(String userId) {
        return pointHistoryRepository.findByUserId(userId);
    }

    public Mono<Point> chargePoint(String userId, int amount) {
        Calendar cal = Calendar.getInstance();
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        Date todayStart = cal.getTime();

        cal.add(Calendar.DATE, 1);
        Date tomorrowStart = cal.getTime();

        return pointHistoryRepository
            .findByUserIdAndTypeAndTimestampGreaterThanEqualAndTimestampLessThan(userId, "CHARGE", todayStart, tomorrowStart)
            .map(PointHistory::getAmount)
            .reduce(0, Integer::sum)
            .flatMap(todayChargedAmount -> {
                if (todayChargedAmount + amount > DAILY_CHARGE_LIMIT) {
                    return Mono.error(new IllegalArgumentException("일일 충전 한도(" + DAILY_CHARGE_LIMIT + "원)를 초과했습니다."));
                }
                return getOrCreatePoint(userId)
                    .flatMap(point -> {
                        point.setAmount(safe(point.getAmount()) + amount);
                        point.setReservedAmount(safe(point.getReservedAmount()));
                        return pointRepository.save(point);
                    })
                    .flatMap(savedPoint -> {
                        PointHistory history = new PointHistory();
                        history.setUserId(userId);
                        history.setAmount(amount);
                        history.setType("CHARGE");
                        history.setDescription("포인트 충전");
                        return pointHistoryRepository.save(history).thenReturn(savedPoint);
                    });
            });
    }

    public Mono<Point> reducePointManually(String userId, int amount, String reason) {
        return getOrCreatePoint(userId)
            .flatMap(point -> {
                if (safe(point.getAmount()) - safe(point.getReservedAmount()) < amount) {
                    return Mono.error(new IllegalArgumentException("포인트 부족. 보유: " + point.getAmount() + ", 예약: " + safe(point.getReservedAmount()) + ", 필요: " + amount));
                }
                point.setAmount(safe(point.getAmount()) - amount);
                point.setReservedAmount(safe(point.getReservedAmount()));
                return pointRepository.save(point);
            })
            .flatMap(savedPoint -> {
                PointHistory history = new PointHistory();
                history.setUserId(userId);
                history.setAmount(amount);
                history.setType("DEDUCT_MANUAL");
                history.setDescription(reason);
                return pointHistoryRepository.save(history).thenReturn(savedPoint);
            });
    }

    public Mono<Point> addPoint(String userId, int amount) {
        return getOrCreatePoint(userId)
            .flatMap(point -> {
                point.setAmount(safe(point.getAmount()) + amount);
                point.setReservedAmount(safe(point.getReservedAmount()));
                return pointRepository.save(point);
            })
            .flatMap(savedPoint -> {
                PointHistory history = new PointHistory();
                history.setUserId(userId);
                history.setAmount(amount);
                history.setType("REFUND");
                history.setDescription("오류로 인한 포인트 환불");
                return pointHistoryRepository.save(history).thenReturn(savedPoint);
            });
    }

    @Transactional
    public Mono<Point> bootstrapInitialPoints(String userId) {
        return Mono.fromCallable(() -> firestore.runTransaction(transaction -> {
            PointState pointState = getOrCreatePointState(transaction, userId);
            if (pointState.point.getAmount() > 0 || pointState.point.getReservedAmount() > 0) {
                return pointState.point;
            }

            pointState.point.setAmount(INITIAL_POINT_AMOUNT);
            pointState.point.setReservedAmount(0);
            transaction.set(pointState.reference, pointState.point);

            PointHistory history = new PointHistory();
            history.setUserId(userId);
            history.setAmount(INITIAL_POINT_AMOUNT);
            history.setType("INITIAL");
            history.setDescription("회원 가입 축하 포인트");
            DocumentReference historyRef = firestore.collection(HISTORIES_COLLECTION).document();
            history.setId(historyRef.getId());
            transaction.set(historyRef, history);

            return pointState.point;
        }).get());
    }

    @Transactional
    public Mono<PointReservation> reservePoints(String reservationId, String userId, int amount, String description) {
        return Mono.fromCallable(() -> firestore.runTransaction(transaction -> {
            DocumentReference reservationRef = firestore.collection(RESERVATIONS_COLLECTION).document(reservationId);
            DocumentSnapshot reservationSnapshot = transaction.get(reservationRef).get();
            if (reservationSnapshot.exists()) {
                PointReservation existing = reservationSnapshot.toObject(PointReservation.class);
                if (existing != null) {
                    return existing;
                }
            }

            PointState pointState = getOrCreatePointState(transaction, userId);
            try {
                PointReservationStateMachine.reserve(pointState.point, amount);
            } catch (IllegalArgumentException e) {
                throw new IllegalArgumentException("포인트 부족. 보유: " + pointState.point.getAmount()
                    + ", 예약: " + pointState.point.getReservedAmount() + ", 필요: " + amount);
            }
            transaction.set(pointState.reference, pointState.point);

            PointReservation reservation = new PointReservation();
            reservation.setId(reservationId);
            reservation.setUserId(userId);
            reservation.setAmount(amount);
            reservation.setStatus(PointReservation.STATUS_RESERVED);
            reservation.setDescription(description);
            reservation.setCreatedAt(new Date());
            reservation.setUpdatedAt(new Date());
            transaction.set(reservationRef, reservation);

            PointHistory history = new PointHistory();
            history.setUserId(userId);
            history.setAmount(amount);
            history.setType("RESERVE");
            history.setDescription(description);
            history.setReservationId(reservationId);
            DocumentReference historyRef = firestore.collection(HISTORIES_COLLECTION).document();
            history.setId(historyRef.getId());
            transaction.set(historyRef, history);

            return reservation;
        }).get());
    }

    @Transactional
    public Mono<PointReservation> confirmReservation(String reservationId) {
        return Mono.fromCallable(() -> firestore.runTransaction(transaction -> {
            DocumentReference reservationRef = firestore.collection(RESERVATIONS_COLLECTION).document(reservationId);
            DocumentSnapshot reservationSnapshot = transaction.get(reservationRef).get();
            if (!reservationSnapshot.exists()) {
                throw new IllegalArgumentException("Reservation not found: " + reservationId);
            }

            PointReservation reservation = reservationSnapshot.toObject(PointReservation.class);
            if (reservation == null) {
                throw new IllegalArgumentException("Reservation payload is empty: " + reservationId);
            }

            PointState pointState = getOrCreatePointState(transaction, reservation.getUserId());
            boolean changed = PointReservationStateMachine.confirm(pointState.point, reservation);
            if (!changed) {
                return reservation;
            }

            transaction.set(pointState.reference, pointState.point);
            reservation.setUpdatedAt(new Date());
            transaction.set(reservationRef, reservation);

            PointHistory history = new PointHistory();
            history.setUserId(reservation.getUserId());
            history.setAmount(reservation.getAmount());
            history.setType("CONFIRM");
            history.setDescription("예약 포인트 차감 확정");
            history.setReservationId(reservationId);
            DocumentReference historyRef = firestore.collection(HISTORIES_COLLECTION).document();
            history.setId(historyRef.getId());
            transaction.set(historyRef, history);

            return reservation;
        }).get());
    }

    @Transactional
    public Mono<PointReservation> cancelReservation(String reservationId) {
        return Mono.fromCallable(() -> firestore.runTransaction(transaction -> {
            DocumentReference reservationRef = firestore.collection(RESERVATIONS_COLLECTION).document(reservationId);
            DocumentSnapshot reservationSnapshot = transaction.get(reservationRef).get();
            if (!reservationSnapshot.exists()) {
                throw new IllegalArgumentException("Reservation not found: " + reservationId);
            }

            PointReservation reservation = reservationSnapshot.toObject(PointReservation.class);
            if (reservation == null) {
                throw new IllegalArgumentException("Reservation payload is empty: " + reservationId);
            }

            PointState pointState = getOrCreatePointState(transaction, reservation.getUserId());
            boolean changed = PointReservationStateMachine.cancel(pointState.point, reservation);
            if (!changed) {
                return reservation;
            }

            transaction.set(pointState.reference, pointState.point);
            reservation.setUpdatedAt(new Date());
            transaction.set(reservationRef, reservation);

            PointHistory history = new PointHistory();
            history.setUserId(reservation.getUserId());
            history.setAmount(reservation.getAmount());
            history.setType("CANCEL");
            history.setDescription("예약 포인트 취소");
            history.setReservationId(reservationId);
            DocumentReference historyRef = firestore.collection(HISTORIES_COLLECTION).document();
            history.setId(historyRef.getId());
            transaction.set(historyRef, history);

            return reservation;
        }).get());
    }

    private Point normalizePoint(Point point) {
        PointReservationStateMachine.ensureInitialized(point);
        return point;
    }

    private int safe(Integer value) {
        return value == null ? 0 : value;
    }

    private PointState getOrCreatePointState(Transaction transaction, String userId) throws Exception {
        QuerySnapshot snapshot = transaction.get(
            firestore.collection(POINTS_COLLECTION).whereEqualTo("userId", userId).limit(1)
        ).get();

        if (!snapshot.isEmpty()) {
            DocumentSnapshot doc = snapshot.getDocuments().get(0);
            Point point = doc.toObject(Point.class);
            if (point == null) {
                point = new Point();
            }
            point.setId(doc.getId());
            point.setUserId(userId);
            PointReservationStateMachine.ensureInitialized(point);
            return new PointState(doc.getReference(), point);
        }

        DocumentReference pointRef = firestore.collection(POINTS_COLLECTION).document();
        Point point = new Point();
        point.setId(pointRef.getId());
        point.setUserId(userId);
        point.setAmount(0);
        point.setReservedAmount(0);
        transaction.set(pointRef, point);
        return new PointState(pointRef, point);
    }

    private static class PointState {
        private final DocumentReference reference;
        private final Point point;

        private PointState(DocumentReference reference, Point point) {
            this.reference = reference;
            this.point = point;
        }
    }
}
