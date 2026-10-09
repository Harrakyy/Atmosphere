import { formatJadwal } from "./time";

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function saveTicketLink(input: {
  code: string;
  roomName: string;
  start: Date;
  end: Date;
  guestCount: number;
  ticketToken: string;
  appUrl: string;
}): string {
  const jadwal = formatJadwal(input.start, input.end);
  const text =
    `Reservasi Atmosphere Cafe ✅\n` +
    `Kode: ${input.code}\n` +
    `Ruangan: ${input.roomName} • ${jadwal}\n` +
    `Tamu: ${input.guestCount} orang\n` +
    `Lihat QR check-in: ${input.appUrl}/tiket/${input.ticketToken}`;

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function contactCafeLink(input: {
  cafeWhatsapp: string;
  customerName: string;
  code: string;
  start: Date;
  end: Date;
}): string {
  const jadwal = formatJadwal(input.start, input.end);
  const text = `Halo Atmosphere Cafe, saya ${input.customerName} dengan reservasi ${input.code} (${jadwal}). Saya ingin bertanya tentang reservasi saya.`;

  return `https://wa.me/${input.cafeWhatsapp}?text=${encodeURIComponent(text)}`;
}

export function cancelLink(input: {
  by: "CAFE" | "CUSTOMER" | "SYSTEM";
  customerPhone: string;
  customerName: string;
  code: string;
  roomName: string;
  start: Date;
  end: Date;
  reason?: string;
  totalAmount: number;
  refundAmount?: number;
}): string {
  const jadwal = formatJadwal(input.start, input.end);
  const reasonText = input.reason ? ` karena ${input.reason}` : "";
  const refundAmount = input.refundAmount ?? (input.by === "CAFE" ? input.totalAmount : 0);

  let text = `Halo Kak ${input.customerName}, kami dari Atmosphere Cafe.\n`;

  if (input.by === "CAFE" || input.by === "SYSTEM") {
    text += `Mohon maaf, reservasi ${input.code} di ${input.roomName} pada ${jadwal} terpaksa kami batalkan${reasonText}.\n`;
    text += `Pembayaran sebesar ${formatRupiah(input.totalAmount)} akan kami refund penuh.\n`;
    text += `Mohon balas dengan: nama bank, nomor rekening, dan nama pemilik rekening. Terima kasih 🙏`;
  } else {
    text += `Sesuai permintaan Kakak, reservasi ${input.code} di ${input.roomName} pada ${jadwal} telah kami batalkan${reasonText}.`;
    if (refundAmount > 0) {
      text += `\nPembayaran sebesar ${formatRupiah(refundAmount)} akan kami refund.\n`;
      text += `Mohon balas dengan: nama bank, nomor rekening, dan nama pemilik rekening. Terima kasih 🙏`;
    }
  }

  return `https://wa.me/${input.customerPhone}?text=${encodeURIComponent(text)}`;
}
