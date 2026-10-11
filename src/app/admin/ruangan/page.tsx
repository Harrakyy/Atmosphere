"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDateIndo } from "@/lib/format";
import { toast } from "sonner";
import { AlertTriangle, Loader2, MapPin, Plus } from "lucide-react";
import { useConfirm } from "@/components/useConfirm";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminRoom {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  minGuests: number;
  maxGuests: number;
  facilities: string[];
  photoUrl: string | null;
  sortOrder: number;
  isArchived: boolean;
}

interface RoomBlockItem {
  id: string;
  roomId: string;
  startAt: string;
  endAt: string | null;
  reason: string;
  createdAt: string;
}

export default function AdminRuanganPage() {
  const router = useRouter();
  const { askConfirm, confirmDialog } = useConfirm();
  const [rooms, setRooms] = useState<AdminRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [blocks, setBlocks] = useState<RoomBlockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form New Room Modal
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomSlug, setRoomSlug] = useState("");
  const [roomLocation, setRoomLocation] = useState("");
  const [roomMinGuests, setRoomMinGuests] = useState(2);
  const [roomMaxGuests, setRoomMaxGuests] = useState(8);
  const [roomFacilitiesStr, setRoomFacilitiesStr] = useState("AC, Smart TV, Wi-Fi, Stopkontak");

  // Form New Block
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockConflicts, setBlockConflicts] = useState<{ id: string; code: string }[] | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/rooms");
      const json = await res.json();
      if (res.status === 401) {
        router.push("/admin/login");
        return;
      }
      if (json.success) {
        setRooms(json.data || []);
        if (json.data && json.data.length > 0) {
          setSelectedRoomId((prev) => prev || json.data[0].id);
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memuat ruangan.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const fetchBlocks = async (roomId: string) => {
    if (!roomId) return;
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}/blocks`);
      const json = await res.json();
      if (json.success) {
        setBlocks(json.data || []);
      }
    } catch {
      toast.error("Gagal memuat daftar blokir jadwal.");
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    if (selectedRoomId) {
      fetchBlocks(selectedRoomId);
    }
  }, [selectedRoomId]);

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const payload = {
        name: roomName.trim(),
        slug: roomSlug.trim() || roomName.toLowerCase().replace(/\s+/g, "-"),
        location: roomLocation.trim() || undefined,
        minGuests: Number(roomMinGuests),
        maxGuests: Number(roomMaxGuests),
        facilities: roomFacilitiesStr.split(",").map((f) => f.trim()).filter(Boolean),
      };

      const url = editingRoomId ? `/api/admin/rooms/${editingRoomId}` : "/api/admin/rooms";
      const method = editingRoomId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal menyimpan ruangan.");
      }

      setShowRoomModal(false);
      toast.success("Ruangan disimpan.");
      setEditingRoomId(null);
      await fetchRooms();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan ruangan.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveRoom = async (roomId: string) => {
    if (!(await askConfirm("Arsipkan ruangan ini?", "Ruangan tidak akan tampil lagi untuk customer."))) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/rooms/${roomId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal mengarsipkan ruangan.");
      }
      await fetchRooms();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengarsipkan ruangan.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoomId) return;
    setActionLoading(true);
    setErrorMsg(null);
    setBlockConflicts(null);

    try {
      const res = await fetch(`/api/admin/rooms/${selectedRoomId}/blocks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // R-B1: mulai 00:00 WIB tanggal awal, sampai 00:00 WIB sehari setelah tanggal akhir
          startAt: `${blockStart}T00:00:00+07:00`,
          endAt: blockEnd
            ? new Date(Date.parse(`${blockEnd}T00:00:00+07:00`) + 86_400_000).toISOString()
            : undefined,
          reason: blockReason.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Gagal membuat blokir.");
      }

      setBlockReason("");
      setBlockStart("");
      setBlockEnd("");

      if (json.data.conflicts && json.data.conflicts.length > 0) {
        setBlockConflicts(json.data.conflicts);
      }

      await fetchBlocks(selectedRoomId);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal membuat blokir.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!(await askConfirm("Hapus blokir jadwal ini?", "Ruangan akan kembali bisa dipesan pada rentang tanggal tersebut."))) return;
    try {
      const res = await fetch(`/api/admin/blocks/${blockId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message || "Gagal menghapus blokir.");
        return;
      }
      toast.success("Blokir jadwal dihapus.");
      await fetchBlocks(selectedRoomId);
    } catch {
      toast.error("Gagal menghapus blokir. Periksa koneksi lalu coba lagi.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {confirmDialog}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-[#1C2955]">
            Manajemen Ruangan & Blokir Jadwal
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Kelola data kapasitas ruangan privat dan blokir tanggal pemeliharaan (maintenance).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingRoomId(null);
            setRoomName("");
            setRoomSlug("");
            setRoomLocation("");
            setRoomMinGuests(2);
            setRoomMaxGuests(8);
            setRoomFacilitiesStr("AC, Smart TV, Wi-Fi, Stopkontak");
            setShowRoomModal(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-xs hover:bg-primary/85 transition-all self-start sm:self-auto"
        >
          <Plus className="size-3.5" /> Tambah Ruangan
        </button>
      </div>

      {errorMsg && (
        <Alert variant="destructive" className="bg-white">
          <AlertTriangle />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Rooms Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5" aria-label="Memuat data ruangan">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {rooms.map((room) => (
          <div
            key={room.id}
            className={`bg-white rounded-3xl p-5 border shadow-xs flex flex-col justify-between transition-all ${
              room.isArchived ? "opacity-60 border-gray-200" : "border-[#DFDDD6]"
            }`}
          >
            <div>
              {room.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={room.photoUrl}
                  alt={`Foto ${room.name}`}
                  loading="lazy"
                  className="w-full h-32 object-cover rounded-2xl mb-3 bg-gray-100"
                />
              )}
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-extrabold text-base text-[#1C2955]">{room.name}</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-[#F3F2EF] rounded-md text-gray-600">
                  {room.minGuests}–{room.maxGuests} tamu
                </span>
              </div>
              {room.location && <p className="flex items-center gap-1 text-xs text-muted-foreground mb-2"><MapPin className="size-3" /> {room.location}</p>}

              <div className="flex flex-wrap gap-1 mt-2">
                {room.facilities.map((fac, idx) => (
                  <span key={idx} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                    {fac}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setEditingRoomId(room.id);
                  setRoomName(room.name);
                  setRoomSlug(room.slug);
                  setRoomLocation(room.location || "");
                  setRoomMinGuests(room.minGuests);
                  setRoomMaxGuests(room.maxGuests);
                  setRoomFacilitiesStr(room.facilities.join(", "));
                  setShowRoomModal(true);
                }}
                className="font-bold text-[#1C2955] hover:underline"
              >
                Edit
              </button>

              {!room.isArchived && (
                <button
                  type="button"
                  onClick={() => handleArchiveRoom(room.id)}
                  className="font-bold text-rose-600 hover:underline"
                >
                  Arsipkan
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    )}

      {/* Room Blocks Section */}
      <div className="bg-white rounded-3xl p-6 border border-[#DFDDD6] shadow-xs flex flex-col gap-6">
        <div className="border-b border-[#DFDDD6] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#1C2955]">
              Blokir Jadwal (Maintenance)
            </h2>
            <p className="text-xs text-gray-500">
              Kunci ketersediaan ruangan agar tidak dapat dipesan pada tanggal tertentu.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="select-room-block" className="text-xs font-bold text-gray-600">Pilih Ruangan:</label>
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger id="select-room-block" size="sm" className="font-bold">
                <SelectValue placeholder="Pilih ruangan" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Conflicts Alert */}
        {blockConflicts && blockConflicts.length > 0 && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-900">
            <AlertTriangle />
            <AlertTitle>Perhatian: Terdapat {blockConflicts.length} reservasi yang bentrok dengan blokir ini:</AlertTitle>
            <AlertDescription className="text-amber-900">
            <div className="flex flex-wrap gap-2 mt-1">
              {blockConflicts.map((c, idx) => (
                <Link key={idx} href={`/admin/reservasi/${c.id}`} className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-amber-200 underline">
                  {c.code}
                </Link>
              ))}
            </div>
            <span className="block mt-2 text-[11px] text-amber-700">
              Reservasi di atas telah dimasukkan ke daftar &quot;Perlu Tindakan&quot; untuk ditindaklanjuti admin.
            </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Form Create Block */}
        <form onSubmit={handleCreateBlock} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs">
          <div>
            <label htmlFor="block-start-date" className="font-bold text-gray-600 block mb-1">Tanggal Mulai</label>
            <input
              id="block-start-date"
              type="date"
              required
              value={blockStart}
              onChange={(e) => setBlockStart(e.target.value)}
              className="w-full p-2 bg-white rounded-xl border border-[#DFDDD6]"
            />
          </div>
          <div>
            <label htmlFor="block-end-date" className="font-bold text-gray-600 block mb-1">Tanggal Akhir (Opsional)</label>
            <input
              id="block-end-date"
              type="date"
              value={blockEnd}
              onChange={(e) => setBlockEnd(e.target.value)}
              className="w-full p-2 bg-white rounded-xl border border-[#DFDDD6]"
            />
          </div>
          <div>
            <label htmlFor="block-reason-input" className="font-bold text-gray-600 block mb-1">Alasan</label>
            <input
              id="block-reason-input"
              type="text"
              required
              placeholder="Contoh: Renovasi atap"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              className="w-full p-2 bg-white rounded-xl border border-[#DFDDD6]"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={actionLoading}
              className="w-full py-2 bg-[#1C2955] text-white font-bold rounded-xl shadow-xs hover:bg-[#1A2751]"
            >
              + Simpan Blokir
            </button>
          </div>
        </form>

        {/* Blocks Table */}
        <div className="divide-y divide-gray-100 text-xs">
          {blocks.length === 0 ? (
            <p className="py-6 text-center text-gray-400">Tidak ada jadwal blokir aktif untuk ruangan ini.</p>
          ) : (
            blocks.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#1C2955]">{b.reason}</span>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {formatDateIndo(b.startAt)} s/d {b.endAt ? formatDateIndo(new Date(Date.parse(b.endAt) - 1)) : "Sampai waktu belum ditentukan"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteBlock(b.id)}
                  className="font-bold text-rose-600 hover:underline text-xs"
                >
                  Hapus
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MODAL: Tambah/Edit Ruangan */}
      <Dialog open={showRoomModal} onOpenChange={setShowRoomModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRoomId ? "Edit Data Ruangan" : "Tambah Ruangan Baru"}</DialogTitle>
            <DialogDescription>Kapasitas menentukan ruangan mana yang muncul untuk jumlah tamu tertentu.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveRoom} className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room-name-modal" className="text-xs font-bold text-gray-600">Nama Ruangan</Label>
              <Input
                id="room-name-modal"
                required
                placeholder="Contoh: Ruangan 5"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room-location-modal" className="text-xs font-bold text-gray-600">Lokasi (Lantai/Area)</Label>
              <Input
                id="room-location-modal"
                placeholder="Contoh: Lantai 2"
                value={roomLocation}
                onChange={(e) => setRoomLocation(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="room-min-guests-modal" className="text-xs font-bold text-gray-600">Min. Tamu</Label>
                <Input
                  id="room-min-guests-modal"
                  type="number"
                  min={1}
                  required
                  value={roomMinGuests}
                  onChange={(e) => setRoomMinGuests(Number(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="room-max-guests-modal" className="text-xs font-bold text-gray-600">Maks. Tamu</Label>
                <Input
                  id="room-max-guests-modal"
                  type="number"
                  min={1}
                  required
                  value={roomMaxGuests}
                  onChange={(e) => setRoomMaxGuests(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="room-facilities-modal" className="text-xs font-bold text-gray-600">Fasilitas (pisahkan koma)</Label>
              <Input
                id="room-facilities-modal"
                value={roomFacilitiesStr}
                onChange={(e) => setRoomFacilitiesStr(e.target.value)}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Batal</Button>
              </DialogClose>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading && <Loader2 className="animate-spin" />}
                Simpan Ruangan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
