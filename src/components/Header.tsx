import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#DFDDD6]">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-bold text-xl tracking-tight text-[#1C2955] group-hover:text-[#D81B60] transition-colors">
            atmosphere.cafe<span className="text-[#D81B60]">_</span>
          </span>
        </Link>

        <nav className="flex items-center gap-3">
          <Link
            href="/cek-reservasi"
            className="text-xs md:text-sm font-medium px-3 py-1.5 rounded-full border border-[#DFDDD6] text-[#1C2955] hover:border-[#1C2955] hover:bg-[#F3F2EF] transition-all"
          >
            Cek Reservasi
          </Link>
          <Link
            href="/admin"
            className="text-xs text-gray-500 hover:text-[#1C2955] px-2 py-1 transition-colors"
          >
            Admin
          </Link>
        </nav>
      </div>
    </header>
  );
}
