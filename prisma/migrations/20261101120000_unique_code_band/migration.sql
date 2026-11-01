-- K-41: kode unik DITAMBAHKAN ke total supaya nominal bayar jatuh di jalur Atmosphere (3 digit akhir 100-499, Protokol Setor)
ALTER TABLE "Reservation" RENAME COLUMN "uniqueDiscount" TO "uniqueCode";

-- payAmount sekarang boleh lebih besar dari totalAmount; refund tetap tidak boleh melebihi uang yang dibayar (R-Q5)
ALTER TABLE "Reservation" DROP CONSTRAINT "reservation_amount_nonneg";
ALTER TABLE "Reservation" ADD CONSTRAINT "reservation_amount_nonneg" CHECK ("totalAmount" >= 0 AND "payAmount" > 0 AND "refundAmount" >= 0 AND "refundAmount" <= "payAmount");
