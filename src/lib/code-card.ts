const W = 1080;
const H = 1350;
const NAVY = "#1C2955";
const MAGENTA = "#D81B60";

interface CodeCardInput {
  code: string;
  roomName: string;
  jadwal: string;
  customerName: string;
}

// Kartu kode digambar langsung di canvas (tanpa library). maxWidth di fillText menyusutkan teks panjang, bukan memotongnya.
export async function downloadCodeCard({ code, roomName, jadwal, customerName }: CodeCardInput) {
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Browser tidak mendukung pembuatan gambar.");

  ctx.fillStyle = "#F3F2EF";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(60, 60, W - 120, H - 120, 48);
  ctx.fill();

  const font = (size: number, weight = 600) => `${weight} ${size}px Inter, Arial, sans-serif`;
  const text = (value: string, y: number, size: number, color: string, weight = 600, maxWidth = W - 240) => {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(value, W / 2, y, maxWidth);
  };

  text("atmosphere.cafe_", 190, 56, NAVY, 800);
  text("KODE RESERVASI", 360, 34, "#6B7280", 700);

  ctx.font = font(240, 800);
  ctx.letterSpacing = "36px";
  ctx.fillStyle = MAGENTA;
  ctx.textAlign = "center";
  // letterSpacing menambah ruang kosong setelah huruf terakhir; geser setengahnya supaya kode tetap di tengah
  ctx.fillText(code, W / 2 + 18, 620, W - 240);
  ctx.letterSpacing = "0px";

  text(roomName, 790, 64, NAVY, 800);
  text(jadwal, 870, 42, NAVY, 600);
  text(`a.n. ${customerName}`, 950, 40, "#4B5563", 500);

  ctx.fillStyle = "#DFDDD6";
  ctx.fillRect(160, 1040, W - 320, 3);
  text("Tunjukkan kode ini ke kasir saat tiba di cafe", 1130, 36, "#4B5563", 500);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Gagal membuat gambar kode.");

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kode-${code}.png`;
  link.click();
  URL.revokeObjectURL(url);
}
