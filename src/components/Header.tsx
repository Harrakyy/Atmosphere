import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="font-bold text-xl tracking-tight text-primary group-hover:text-brand transition-colors">
            atmosphere.cafe<span className="text-brand">_</span>
          </span>
        </Link>

        <nav className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href="/cek-reservasi">
              <Search />
              Cek Reservasi
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex text-muted-foreground">
            <Link href="/admin">Admin</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
