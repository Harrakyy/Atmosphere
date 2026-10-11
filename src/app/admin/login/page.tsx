"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AlertTriangle, Loader2, LogIn } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (res.error) {
        throw new Error(res.error.message || "Email atau password salah.");
      }

      router.push("/admin");
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal masuk ke akun admin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full rounded-3xl p-8 shadow-sm">
        <div className="text-center">
          <span className="font-extrabold text-2xl tracking-tight">
            atmosphere.cafe<span className="text-brand">_</span>
          </span>
          <h1 className="text-lg font-bold mt-2">Portal Masuk Admin</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Gunakan akun staf atau kasir yang terdaftar untuk mengelola reservasi.
          </p>
        </div>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-email" className="text-xs font-bold uppercase text-gray-700">
              Email
            </Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              placeholder="admin@atmosphere.cafe"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-password" className="text-xs font-bold uppercase text-gray-700">
              Password
            </Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>

          <Button type="submit" size="xl" className="mt-2 w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <LogIn />}
            {loading ? "Memverifikasi..." : "Masuk ke Dashboard"}
          </Button>
        </form>

        <div className="pt-4 border-t text-center">
          <span className="text-[11px] text-muted-foreground">
            Pendaftaran publik dinonaktifkan. Hubungi administrator sistem untuk reset akun.
          </span>
        </div>
      </Card>
    </div>
  );
}
