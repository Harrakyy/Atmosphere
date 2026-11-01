// QR pairing yang dipindai kamera biasa (bukan dari app Setor) membuka halaman ini: arahkan ke unduhan Setor
export const metadata = { title: "Hubungkan HP Setor", robots: { index: false } };

export default function SetorPair() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-extrabold text-[#1C2955]">Buka QR ini dari app Setor</h1>
      <p className="text-gray-600">
        QR ini untuk menghubungkan HP kasir. Pasang Setor, lalu buka tab Usaha → + → Scan QR dari web usaha dan pindai QR di halaman admin.
      </p>
      <a
        className="rounded-full bg-[#1C2955] px-6 py-3 font-bold text-white"
        href="https://github.com/Harrakyy/Setor/releases/download/latest/Setor-latest-debug.apk"
      >
        Unduh Setor (Android)
      </a>
    </main>
  );
}
