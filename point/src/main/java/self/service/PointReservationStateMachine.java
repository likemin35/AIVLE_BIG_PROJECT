package self.service;

import self.domain.Point;
import self.domain.PointReservation;

public final class PointReservationStateMachine {

    private PointReservationStateMachine() {
    }

    public static void ensureInitialized(Point point) {
        if (point.getAmount() == null) {
            point.setAmount(0);
        }
        if (point.getReservedAmount() == null) {
            point.setReservedAmount(0);
        }
    }

    public static void reserve(Point point, int amount) {
        ensureInitialized(point);
        if (point.getAmount() - point.getReservedAmount() < amount) {
            throw new IllegalArgumentException("Insufficient available points");
        }
        point.setReservedAmount(point.getReservedAmount() + amount);
    }

    public static boolean confirm(Point point, PointReservation reservation) {
        ensureInitialized(point);
        if (PointReservation.STATUS_CONFIRMED.equals(reservation.getStatus())
            || PointReservation.STATUS_CANCELED.equals(reservation.getStatus())) {
            return false;
        }
        if (point.getReservedAmount() < reservation.getAmount()) {
            throw new IllegalStateException("Reserved amount is smaller than reservation amount");
        }
        point.setReservedAmount(point.getReservedAmount() - reservation.getAmount());
        point.setAmount(point.getAmount() - reservation.getAmount());
        reservation.setStatus(PointReservation.STATUS_CONFIRMED);
        return true;
    }

    public static boolean cancel(Point point, PointReservation reservation) {
        ensureInitialized(point);
        if (PointReservation.STATUS_CANCELED.equals(reservation.getStatus())
            || PointReservation.STATUS_CONFIRMED.equals(reservation.getStatus())) {
            return false;
        }
        point.setReservedAmount(Math.max(0, point.getReservedAmount() - reservation.getAmount()));
        reservation.setStatus(PointReservation.STATUS_CANCELED);
        return true;
    }
}
