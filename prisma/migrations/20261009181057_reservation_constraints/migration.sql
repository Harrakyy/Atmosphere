CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    tstzrange("startAt", "blockEndAt", '[)') WITH &&
  ) WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'));

ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_time_order" CHECK ("endAt" > "startAt");
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_amount_nonneg" CHECK ("totalAmount" >= 0 AND "refundAmount" >= 0 AND "refundAmount" <= "totalAmount");
ALTER TABLE "Room" ADD CONSTRAINT "room_guest_range" CHECK ("minGuests" >= 1 AND "maxGuests" >= "minGuests");