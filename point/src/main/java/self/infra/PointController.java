package self.infra;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import self.domain.Point;
import self.domain.PointHistory;
import self.service.PointService;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping(value = "/api/points")
public class PointController {

    @Autowired
    private PointService pointService;

    // Firebase UID로 포인트 조회
    @GetMapping("/{firebaseUid}")
    public Mono<ResponseEntity<Object>> getPointByFirebaseUid(@PathVariable String firebaseUid) {
        return pointService.getOrCreatePoint(firebaseUid)
                .map(point -> ResponseEntity.ok(new PointResponse(point.getId(), point.getUserId(), point.getAmount())))
                .cast(ResponseEntity.class)
                .onErrorResume(e -> Mono.just(ResponseEntity.badRequest().body("포인트 조회 실패: " + e.getMessage())))
                .map(response -> (ResponseEntity<Object>) response);
    }

    // 포인트 변동 내역 조회 API
    @GetMapping("/{firebaseUid}/history")
    public Flux<PointHistory> getPointHistory(@PathVariable String firebaseUid) {
        return pointService.getPointHistory(firebaseUid);
    }

    // 포인트 충전 API (비동기 처리)
    @PostMapping("/{firebaseUid}/charge")
    public Mono<ResponseEntity<Object>> chargePoint(@PathVariable String firebaseUid, @RequestBody ChargeRequest chargeRequest) {
        // 백그라운드에서 포인트 충전 로직 실행
        CompletableFuture.runAsync(() -> {
            pointService.chargePoint(firebaseUid, chargeRequest.getAmount()).subscribe(
                updatedPoint -> System.out.println("포인트 충전 성공: " + updatedPoint.getUserId()),
                error -> System.err.println("포인트 충전 실패: " + error.getMessage())
            );
        });

        // 클라이언트에게 즉시 응답 반환
        return Mono.just(ResponseEntity.ok().body("포인트 충전 요청이 성공적으로 접수되었습니다."));
    }

    // 포인트 수동 차감 API (reason 파라미터 추가)
    @PostMapping("/{firebaseUid}/reduce")
    public Mono<ResponseEntity<Object>> reducePoint(
            @PathVariable String firebaseUid,
            @RequestParam Integer amount,
            @RequestParam(defaultValue = "포인트 사용") String reason) {
        return pointService.reducePointManually(firebaseUid, amount, reason)
                .map(updatedPoint -> ResponseEntity.ok(new PointResponse(updatedPoint.getId(), updatedPoint.getUserId(), updatedPoint.getAmount())))
                .cast(ResponseEntity.class)
                .onErrorResume(IllegalArgumentException.class, e -> 
                    Mono.just(ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage())))
                )
                .onErrorResume(e -> 
                    Mono.just(ResponseEntity.status(500).body(new ErrorResponse("포인트 차감 실패: " + e.getMessage())))
                )
                .map(response -> (ResponseEntity<Object>) response);
    }

    // 포인트 환불 API (롤백용)
    @PostMapping("/{firebaseUid}/add")
    public Mono<ResponseEntity<Object>> addPoint(@PathVariable String firebaseUid, @RequestParam Integer amount) {
        return pointService.addPoint(firebaseUid, amount)
                .map(updatedPoint -> ResponseEntity.ok(new PointResponse(updatedPoint.getId(), updatedPoint.getUserId(), updatedPoint.getAmount())))
                .cast(ResponseEntity.class)
                .onErrorResume(e -> 
                    Mono.just(ResponseEntity.status(500).body(new ErrorResponse("포인트 환불 실패: " + e.getMessage())))
                )
                .map(response -> (ResponseEntity<Object>) response);
    }

    // Request DTO for charging points
    public static class ChargeRequest {
        private Integer amount;
        public Integer getAmount() { return amount; }
        public void setAmount(Integer amount) { this.amount = amount; }
    }

    // Response DTO
    public static class PointResponse {
        private String id;
        private String userId;
        private Integer amount;

        public PointResponse(String id, String userId, Integer amount) {
            this.id = id;
            this.userId = userId;
            this.amount = amount;
        }

        // Getters
        public String getId() { return id; }
        public String getUserId() { return userId; }
        public Integer getAmount() { return amount; }
    }

    // Error Response DTO
    public static class ErrorResponse {
        private String error;

        public ErrorResponse(String error) {
            this.error = error;
        }

        // Getter
        public String getError() { return error; }
    }
}