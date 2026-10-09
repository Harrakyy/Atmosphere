import { describe, it, expect } from "vitest";
import { saveTicketLink, contactCafeLink, cancelLink } from "@/server/wa";
import { wibDateTime } from "@/server/time";

describe("wa.ts R-W1 to R-W4", () => {
  const start = wibDateTime("2026-10-18", "10:00");
  const end = wibDateTime("2026-10-18", "12:00");

  it("R-W1: saveTicketLink generates valid wa.me share link", () => {
    const url = saveTicketLink({
      code: "ATM-7K2F9Q",
      roomName: "The Loft",
      start,
      end,
      guestCount: 5,
      ticketToken: "tok1234567890abcdefghijklmnopq",
      appUrl: "https://atmosphere.cafe",
    });

    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(url.replace("https://wa.me/?text=", ""));
    expect(text).toContain("Reservasi Atmosphere Cafe ✅");
    expect(text).toContain("Kode: ATM-7K2F9Q");
    expect(text).toContain("Ruangan: The Loft • Min, 18 Okt 2026, 10.00–12.00");
    expect(text).toContain("Tamu: 5 orang");
    expect(text).toContain("Lihat QR check-in: https://atmosphere.cafe/tiket/tok1234567890abcdefghijklmnopq");
  });

  it("R-W2: contactCafeLink generates cafe contact link", () => {
    const url = contactCafeLink({
      cafeWhatsapp: "6281234567890",
      customerName: "Budi",
      code: "ATM-7K2F9Q",
      start,
      end,
    });

    expect(url.startsWith("https://wa.me/6281234567890?text=")).toBe(true);
    const text = decodeURIComponent(url.replace("https://wa.me/6281234567890?text=", ""));
    expect(text).toBe("Halo Atmosphere Cafe, saya Budi dengan reservasi ATM-7K2F9Q (Min, 18 Okt 2026, 10.00–12.00). Saya ingin bertanya tentang reservasi saya.");
  });

  it("R-W3: cancelLink for CAFE cancellation with full refund", () => {
    const url = cancelLink({
      by: "CAFE",
      customerPhone: "628999888777",
      customerName: "Budi",
      code: "ATM-7K2F9Q",
      roomName: "The Loft",
      start,
      end,
      reason: "ada renovasi AC mendadak",
      totalAmount: 150000,
      refundAmount: 150000,
    });

    expect(url.startsWith("https://wa.me/628999888777?text=")).toBe(true);
    const text = decodeURIComponent(url.replace("https://wa.me/628999888777?text=", ""));
    expect(text).toContain("Halo Kak Budi, kami dari Atmosphere Cafe.");
    expect(text).toContain("Mohon maaf, reservasi ATM-7K2F9Q di The Loft pada Min, 18 Okt 2026, 10.00–12.00 terpaksa kami batalkan karena ada renovasi AC mendadak.");
    expect(text).toContain("Pembayaran sebesar Rp 150.000 akan kami refund penuh.");
    expect(text).toContain("Mohon balas dengan: nama bank, nomor rekening, dan nama pemilik rekening. Terima kasih 🙏");
  });

  it("R-W4: cancelLink for CUSTOMER cancellation with 0 refund", () => {
    const url = cancelLink({
      by: "CUSTOMER",
      customerPhone: "628999888777",
      customerName: "Budi",
      code: "ATM-7K2F9Q",
      roomName: "The Loft",
      start,
      end,
      reason: "jadwal meeting dibatalkan",
      totalAmount: 150000,
      refundAmount: 0,
    });

    const text = decodeURIComponent(url.replace("https://wa.me/628999888777?text=", ""));
    expect(text).toContain("Halo Kak Budi, kami dari Atmosphere Cafe.");
    expect(text).toContain("Sesuai permintaan Kakak, reservasi ATM-7K2F9Q di The Loft pada Min, 18 Okt 2026, 10.00–12.00 telah kami batalkan");
    expect(text).not.toContain("refund");
    expect(text).not.toContain("nomor rekening");
  });
});
