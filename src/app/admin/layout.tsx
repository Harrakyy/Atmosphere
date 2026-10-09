"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Jika di halaman login, tampilkan layar login utuh tanpa header/sidebar
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const navItems = [
    { label: "📋 Reservasi", href: "/admin", active: pathname === "/admin" || pathname.startsWith("/admin/reservasi") },
    { label: "🍳 Dapur", href: "/admin/dapur", active: pathname === "/admin/dapur" },
    { label: "🚪 Ruangan", href: "/admin/ruangan", active: pathname === "/admin/ruangan" },
    { label: "🍽️ Menu", href: "/admin/menu", active: pathname === "/admin/menu" },
    { label: "⚙️ Pengaturan", href: "/admin/pengaturan", active: pathname === "/admin/pengaturan" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F3F2EF]">
      {/* Top Admin Navbar */}
      <header className="sticky top-0 z-40 bg-[#1C2955] text-white border-b border-[#1A2751] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-extrabold text-lg tracking-tight">
              atmosphere<span className="text-[#D81B60]">.admin</span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                    item.active
                      ? "bg-white/20 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="text-xs text-white/70 hover:text-white hidden sm:inline-block px-2.5 py-1 rounded-md border border-white/20"
            >
              Lihat Web ↗
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile Navigation Bar */}
        <div className="md:hidden flex items-center gap-1 overflow-x-auto px-3 py-2 border-t border-white/10 scrollbar-none">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                item.active
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:py-8">
        {children}
      </main>
    </div>
  );
}
