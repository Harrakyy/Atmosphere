"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { CalendarDays, ChefHat, DoorOpen, ExternalLink, LogOut, Settings, UtensilsCrossed } from "lucide-react";

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
    { label: "Reservasi", icon: CalendarDays, href: "/admin", active: pathname === "/admin" || pathname.startsWith("/admin/reservasi") },
    { label: "Dapur", icon: ChefHat, href: "/admin/dapur", active: pathname === "/admin/dapur" },
    { label: "Ruangan", icon: DoorOpen, href: "/admin/ruangan", active: pathname === "/admin/ruangan" },
    { label: "Menu", icon: UtensilsCrossed, href: "/admin/menu", active: pathname === "/admin/menu" },
    { label: "Pengaturan", icon: Settings, href: "/admin/pengaturan", active: pathname === "/admin/pengaturan" },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Admin Navbar */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground border-b border-primary shadow-xs">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-extrabold text-lg tracking-tight">
              atmosphere<span className="text-brand">.admin</span>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                    item.active
                      ? "bg-white/20 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              className="text-xs text-white/70 hover:text-white hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-white/20"
            >
              Lihat Web <ExternalLink className="size-3" />
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="text-xs font-bold px-3 py-1.5 inline-flex items-center gap-1.5 rounded-lg bg-rose-500/20 text-rose-200 hover:bg-rose-500/30 transition-colors"
            >
              <LogOut className="size-3.5" />
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
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                item.active
                  ? "bg-white/20 text-white"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <item.icon className="size-3.5" />
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
