package self.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.stream.function.StreamBridge;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import self.domain.*;

import java.util.Calendar;
import java.util.Date;

@Service
public class PointService {

    @Autowired
    private PointRepository pointRepository;

    @Autowired
    private PointHistoryRepository pointHistoryRepository;

    @Autowired
    private StreamBridge streamBridge;

    private static final int DEDUCTION_AMOUNT = 5000;
    private static final int DAILY_CHARGE_LIMIT = 1000000;

    // --- 이벤트 핸들러 메소드 ---
    public void reducePointForEvent(String userId, String reason) {
        pointRepository.findByUserId(userId).subscribe(point -> {
            if (point.getAmount() >= DEDUCTION_AMOUNT) {
                point.setAmount(point.getAmount() - DEDUCTION_AMOUNT);
                pointRepository.save(point).subscribe(savedPoint -> {
                    PointHistory history = new PointHistory();
                    history.setUserId(userId);
                    history.setAmount(DEDUCTION_AMOUNT);
                    history.setType("DEDUCT");
                    history.setDescription(reason);
                    pointHistoryRepository.save(history).subscribe();

                    PointReduced pointReduced = new PointReduced(savedPoint);
                    streamBridge.send("event-out", pointReduced);
                    System.out.println("포인트 차감 완료: " + userId + ", 사유: " + reason +
                                       ", 차감: " + DEDUCTION_AMOUNT + ", 남은 포인트: " + savedPoint.getAmount());
                });
            } else {
                System.out.println("포인트 부족: " + userId + ", 보유: " + point.getAmount() +
                                   ", 필요: " + DEDUCTION_AMOUNT);
            }
        });
    }
    
    public void createInitialPoint(UserSignedUp event) {
        Point point = new Point();
        point.setUserId(event.getUserId());
        point.setAmount(100000); // 초기 지급 포인트
        pointRepository.save(point).subscribe(savedPoint -> {
            PointHistory history = new PointHistory();
            history.setUserId(event.getUserId());
            history.setAmount(100000);
            history.setType("INITIAL");
            history.setDescription("신규 가입 축하 포인트");
            pointHistoryRepository.save(history).subscribe();

            PointPurchased pointPurchased = new PointPurchased(savedPoint);
            streamBridge.send("event-out", pointPurchased);
        });
    }

    // --- 컨트롤러용 리액티브 메소드 ---
    public Mono<Point> getOrCreatePoint(String userId) {
        return pointRepository.findByUserId(userId)
                .switchIfEmpty(Mono.defer(() -> {
                    Point newPoint = new Point();
                    newPoint.setUserId(userId);
                    newPoint.setAmount(0);
                    return pointRepository.save(newPoint);
                }));
    }

    public Flux<PointHistory> getPointHistory(String userId) {
        // 정렬 기능을 우선 제거하여 기본적인 쿼리가 작동하는지 확인합니다.
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
                        return Mono.error(new IllegalArgumentException("일일 충전 한도(" + DAILY_CHARGE_LIMIT + "원)를 초과했습니다. 오늘 이미 " + todayChargedAmount + "원을 충전했습니다."));
                    }
                    return getOrCreatePoint(userId)
                            .flatMap(point -> {
                                point.setAmount(point.getAmount() + amount);
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
                    if (point.getAmount() < amount) {
                        return Mono.error(new IllegalArgumentException("포인트 부족. 보유: " + point.getAmount() + ", 필요: " + amount));
                    }
                    point.setAmount(point.getAmount() - amount);
                    return pointRepository.save(point);
                })
                .flatMap(savedPoint -> {
                    PointHistory history = new PointHistory();
                    history.setUserId(userId);
                    history.setAmount(amount);
                    history.setType("DEDUCT_MANUAL");
                    history.setDescription(reason); // 전달받은 reason으로 설정
                    return pointHistoryRepository.save(history).thenReturn(savedPoint);
                });
    }

    public Mono<Point> addPoint(String userId, int amount) {
        return getOrCreatePoint(userId)
                .flatMap(point -> {
                    point.setAmount(point.getAmount() + amount);
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
}
