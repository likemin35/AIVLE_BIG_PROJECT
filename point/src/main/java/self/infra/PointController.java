package self.infra;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import self.domain.Point;
import self.domain.PointHistory;
import self.domain.PointReservation;
import self.service.PointService;

@RestController
@RequestMapping(value = "/api/points")
public class PointController {

    @Autowired
    private PointService pointService;

    @Value("${INTERNAL_CALLBACK_TOKEN:}")
    private String internalCallbackToken;

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

    // 포인트 충전 API (동기 처리로 변경)
    @PostMapping("/{firebaseUid}/charge")
    public Mono<ResponseEntity<Object>> chargePoint(@PathVariable String firebaseUid, @RequestBody ChargeRequest chargeRequest) {
        return pointService.chargePoint(firebaseUid, chargeRequest.getAmount())
                .map(updatedPoint -> ResponseEntity.ok(new PointResponse(updatedPoint.getId(), updatedPoint.getUserId(), updatedPoint.getAmount())))
                .cast(ResponseEntity.class)
                .onErrorResume(IllegalArgumentException.class, e ->
                        Mono.just(ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage())))
                )
                .onErrorResume(e ->
                        Mono.just(ResponseEntity.status(500).body(new ErrorResponse("포인트 충전 중 서버 오류가 발생했습니다: " + e.getMessage())))
                )
                .map(response -> (ResponseEntity<Object>) response);
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

    @PostMapping("/internal/reservations")
    public Mono<ResponseEntity<Object>> reservePoints(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @RequestBody ReservationRequest request) {
        try {
            verifyInternalToken(authorizationHeader);
            return pointService.reservePoints(
                    request.getReservationId(),
                    request.getUserId(),
                    request.getAmount(),
                    request.getDescription()
                )
                .map(reservation -> ResponseEntity.ok(toReservationResponse(reservation)))
                .cast(ResponseEntity.class)
                .onErrorResume(IllegalArgumentException.class, e ->
                    Mono.just(ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage())))
                )
                .onErrorResume(e ->
                    Mono.just(ResponseEntity.status(500).body(new ErrorResponse("포인트 예약 실패: " + e.getMessage())))
                )
                .map(response -> (ResponseEntity<Object>) response);
        } catch (Exception e) {
            return Mono.just(ResponseEntity.status(401).body(new ErrorResponse(e.getMessage())));
        }
    }

    @PostMapping("/internal/reservations/{reservationId}/confirm")
    public Mono<ResponseEntity<Object>> confirmReservation(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @PathVariable String reservationId) {
        try {
            verifyInternalToken(authorizationHeader);
            return pointService.confirmReservation(reservationId)
                .map(reservation -> ResponseEntity.ok(toReservationResponse(reservation)))
                .cast(ResponseEntity.class)
                .onErrorResume(IllegalArgumentException.class, e ->
                    Mono.just(ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage())))
                )
                .onErrorResume(e ->
                    Mono.just(ResponseEntity.status(500).body(new ErrorResponse("포인트 예약 확정 실패: " + e.getMessage())))
                )
                .map(response -> (ResponseEntity<Object>) response);
        } catch (Exception e) {
            return Mono.just(ResponseEntity.status(401).body(new ErrorResponse(e.getMessage())));
        }
    }

    @PostMapping("/internal/reservations/{reservationId}/cancel")
    public Mono<ResponseEntity<Object>> cancelReservation(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @PathVariable String reservationId) {
        try {
            verifyInternalToken(authorizationHeader);
            return pointService.cancelReservation(reservationId)
                .map(reservation -> ResponseEntity.ok(toReservationResponse(reservation)))
                .cast(ResponseEntity.class)
                .onErrorResume(IllegalArgumentException.class, e ->
                    Mono.just(ResponseEntity.badRequest().body(new ErrorResponse(e.getMessage())))
                )
                .onErrorResume(e ->
                    Mono.just(ResponseEntity.status(500).body(new ErrorResponse("포인트 예약 취소 실패: " + e.getMessage())))
                )
                .map(response -> (ResponseEntity<Object>) response);
        } catch (Exception e) {
            return Mono.just(ResponseEntity.status(401).body(new ErrorResponse(e.getMessage())));
        }
    }

    @PostMapping("/internal/bootstrap/{firebaseUid}")
    public Mono<ResponseEntity<Object>> bootstrapInitialPoints(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            @PathVariable String firebaseUid) {
        try {
            verifyInternalToken(authorizationHeader);
            return pointService.bootstrapInitialPoints(firebaseUid)
                .map(updatedPoint -> ResponseEntity.ok(new PointResponse(updatedPoint.getId(), updatedPoint.getUserId(), updatedPoint.getAmount())))
                .cast(ResponseEntity.class)
                .onErrorResume(e ->
                    Mono.just(ResponseEntity.status(500).body(new ErrorResponse("초기 포인트 지급 실패: " + e.getMessage())))
                )
                .map(response -> (ResponseEntity<Object>) response);
        } catch (Exception e) {
            return Mono.just(ResponseEntity.status(401).body(new ErrorResponse(e.getMessage())));
        }
    }

    // Request DTO for charging points
    public static class ChargeRequest {
        private Integer amount;
        public Integer getAmount() { return amount; }
        public void setAmount(Integer amount) { this.amount = amount; }
    }

    public static class ReservationRequest {
        private String reservationId;
        private String userId;
        private Integer amount;
        private String description;

        public String getReservationId() { return reservationId; }
        public void setReservationId(String reservationId) { this.reservationId = reservationId; }
        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        public Integer getAmount() { return amount; }
        public void setAmount(Integer amount) { this.amount = amount; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
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

    public static class PointReservationResponse {
        private String reservationId;
        private String userId;
        private Integer amount;
        private String status;

        public PointReservationResponse(String reservationId, String userId, Integer amount, String status) {
            this.reservationId = reservationId;
            this.userId = userId;
            this.amount = amount;
            this.status = status;
        }

        public String getReservationId() { return reservationId; }
        public String getUserId() { return userId; }
        public Integer getAmount() { return amount; }
        public String getStatus() { return status; }
    }

    private PointReservationResponse toReservationResponse(PointReservation reservation) {
        return new PointReservationResponse(
                reservation.getId(),
                reservation.getUserId(),
                reservation.getAmount(),
                reservation.getStatus()
        );
    }

    private void verifyInternalToken(String authorizationHeader) {
        if (internalCallbackToken == null || internalCallbackToken.isBlank()) {
            return;
        }
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new IllegalArgumentException("Missing internal bearer token");
        }
        String token = authorizationHeader.substring(7);
        if (!internalCallbackToken.equals(token)) {
            throw new IllegalArgumentException("Invalid internal bearer token");
        }
    }
}
