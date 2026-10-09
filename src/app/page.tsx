export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center bg-[#F3F2EF] text-[#1C2955]">
      <div className="max-w-md p-8 bg-white rounded-2xl shadow-sm border border-[#DFDDD6]">
        <h1 className="text-2xl font-bold tracking-tight mb-2">
          Atmosphere Cafe
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Sistem Reservasi Ruangan & Pre-Order Menu
        </p>
        <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
          API & Mesin Reservasi Aktif
        </div>
      </div>
    </main>
  );
}
