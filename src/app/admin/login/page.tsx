"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F3F2EF]">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#DFDDD6] shadow-sm">
        <div className="text-center mb-8">
          <span className="font-extrabold text-2xl tracking-tight text-[#1C2955]">
            atmosphere.cafe<span className="text-[#D81B60]">_</span>
          </span>
          <h1 className="text-lg font-bold text-[#1C2955] mt-2">
            Portal Masuk Admin
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Gunakan akun staf atau kasir yang terdaftar untuk mengelola reservasi.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              required
              placeholder="admin@atmosphere.cafe"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFDDD6] focus:border-[#1C2955] outline-none text-sm text-[#1C2955] bg-white font-medium"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-bold text-gray-700 uppercase mb-1">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFDDD6] focus:border-[#1C2955] outline-none text-sm text-[#1C2955] bg-white font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3 bg-[#1C2955] hover:bg-[#1A2751] text-white font-bold text-sm rounded-xl shadow-xs active:scale-98 transition-all"
          >
            {loading ? "Memverifikasi..." : "Masuk ke Dashboard →"}
          </button>
        </form>

        <div className="mt-8 pt-4 border-t border-gray-100 text-center">
          <span className="text-[11px] text-gray-400">
            Pendaftaran publik dinonaktifkan. Hubungi administrator sistem untuk reset akun.
          </span>
        </div>
      </div>
    </div>
  );
}
