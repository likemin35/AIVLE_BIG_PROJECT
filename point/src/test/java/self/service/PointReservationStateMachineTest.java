package self.service;

import org.junit.jupiter.api.Test;
import self.domain.Point;
import self.domain.PointReservation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PointReservationStateMachineTest {

    @Test
    void confirm_isIdempotentAndDoesNotDoubleDeduct() {
        Point point = new Point();
        point.setAmount(10000);
        point.setReservedAmount(5000);

        PointReservation reservation = new PointReservation();
        reservation.setAmount(5000);
        reservation.setStatus(PointReservation.STATUS_RESERVED);

        boolean first = PointReservationStateMachine.confirm(point, reservation);
        boolean second = PointReservationStateMachine.confirm(point, reservation);

        assertTrue(first);
        assertFalse(second);
        assertEquals(5000, point.getAmount());
        assertEquals(0, point.getReservedAmount());
        assertEquals(PointReservation.STATUS_CONFIRMED, reservation.getStatus());
    }

    @Test
    void cancel_isIdempotentAndDoesNotDoubleRelease() {
        Point point = new Point();
        point.setAmount(10000);
        point.setReservedAmount(5000);

        PointReservation reservation = new PointReservation();
        reservation.setAmount(5000);
        reservation.setStatus(PointReservation.STATUS_RESERVED);

        boolean first = PointReservationStateMachine.cancel(point, reservation);
        boolean second = PointReservationStateMachine.cancel(point, reservation);

        assertTrue(first);
        assertFalse(second);
        assertEquals(10000, point.getAmount());
        assertEquals(0, point.getReservedAmount());
        assertEquals(PointReservation.STATUS_CANCELED, reservation.getStatus());
    }

    @Test
    void reserve_increasesReservedAmountOnce() {
        Point point = new Point();
        point.setAmount(20000);
        point.setReservedAmount(0);

        PointReservationStateMachine.reserve(point, 5000);

        assertEquals(20000, point.getAmount());
        assertEquals(5000, point.getReservedAmount());
    }
}
