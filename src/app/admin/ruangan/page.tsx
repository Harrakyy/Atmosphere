"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDateIndo } from "@/lib/format";

interface AdminRoom {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  minGuests: number;
  maxGuests: number;
  facilities: string[];
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
  const [blockConflicts, setBlockConflicts] = useState<{ code: string }[] | null>(null);
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
      // ignore
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
      setEditingRoomId(null);
      await fetchRooms();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menyimpan ruangan.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveRoom = async (roomId: string) => {
    if (!confirm("Apakah Anda yakin ingin mengarsipkan ruangan ini?")) return;
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
          startAt: blockStart,
          endAt: blockEnd || undefined,
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
    if (!confirm("Hapus blokir jadwal ini?")) return;
    try {
      await fetch(`/api/admin/blocks/${blockId}`, { method: "DELETE" });
      await fetchBlocks(selectedRoomId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col gap-6">
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
          className="px-4 py-2 bg-[#1C2955] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[#1A2751] transition-all self-start sm:self-auto"
        >
          + Tambah Ruangan
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Rooms Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-gray-400">Memuat data ruangan...</div>
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
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-extrabold text-base text-[#1C2955]">{room.name}</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 bg-[#F3F2EF] rounded-md text-gray-600">
                  {room.minGuests}–{room.maxGuests} tamu
                </span>
              </div>
              {room.location && <p className="text-xs text-gray-500 mb-2">📍 {room.location}</p>}

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
            <select
              id="select-room-block"
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-[#DFDDD6] text-xs font-bold text-[#1C2955] bg-white outline-none"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Conflicts Alert */}
        {blockConflicts && blockConflicts.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs text-amber-900">
            <span className="font-bold block mb-1">
              ⚠️ Perhatian: Terdapat {blockConflicts.length} reservasi yang bentrok dengan blokir ini:
            </span>
            <div className="flex flex-wrap gap-2 mt-1">
              {blockConflicts.map((c, idx) => (
                <span key={idx} className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-amber-200">
                  {c.code}
                </span>
              ))}
            </div>
            <span className="block mt-2 text-[11px] text-amber-700">
              Reservasi di atas telah dimasukkan ke daftar &quot;Perlu Tindakan&quot; untuk ditindaklanjuti admin.
            </span>
          </div>
        )}

        {/* Form Create Block */}
        <form onSubmit={handleCreateBlock} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-200 text-xs">
          <div>
            <label htmlFor="block-start-date" className="font-bold text-gray-600 block mb-1">Mulai Blokir</label>
            <input
              id="block-start-date"
              type="datetime-local"
              required
              value={blockStart}
              onChange={(e) => setBlockStart(e.target.value)}
              className="w-full p-2 bg-white rounded-xl border border-[#DFDDD6]"
            />
          </div>
          <div>
            <label htmlFor="block-end-date" className="font-bold text-gray-600 block mb-1">Selesai (Opsional)</label>
            <input
              id="block-end-date"
              type="datetime-local"
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
                    {formatDateIndo(b.startAt)} s/d {b.endAt ? formatDateIndo(b.endAt) : "Sampai waktu belum ditentukan"}
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
      {showRoomModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-lg border border-[#DFDDD6]">
            <h3 className="text-base font-bold text-[#1C2955] mb-4">
              {editingRoomId ? "Edit Data Ruangan" : "Tambah Ruangan Baru"}
            </h3>
            <form onSubmit={handleSaveRoom} className="flex flex-col gap-3 text-xs">
              <div>
                <label htmlFor="room-name-modal" className="font-bold text-gray-600 block mb-1">Nama Ruangan</label>
                <input
                  id="room-name-modal"
                  type="text"
                  required
                  placeholder="Contoh: The Loft"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                />
              </div>

              <div>
                <label htmlFor="room-location-modal" className="font-bold text-gray-600 block mb-1">Lokasi (Lantai/Area)</label>
                <input
                  id="room-location-modal"
                  type="text"
                  placeholder="Contoh: Lantai 2"
                  value={roomLocation}
                  onChange={(e) => setRoomLocation(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="room-min-guests-modal" className="font-bold text-gray-600 block mb-1">Min. Tamu</label>
                  <input
                    id="room-min-guests-modal"
                    type="number"
                    min={1}
                    required
                    value={roomMinGuests}
                    onChange={(e) => setRoomMinGuests(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                  />
                </div>
                <div>
                  <label htmlFor="room-max-guests-modal" className="font-bold text-gray-600 block mb-1">Maks. Tamu</label>
                  <input
                    id="room-max-guests-modal"
                    type="number"
                    min={1}
                    required
                    value={roomMaxGuests}
                    onChange={(e) => setRoomMaxGuests(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="room-facilities-modal" className="font-bold text-gray-600 block mb-1">Fasilitas (Pisahkan koma)</label>
                <input
                  id="room-facilities-modal"
                  type="text"
                  value={roomFacilitiesStr}
                  onChange={(e) => setRoomFacilitiesStr(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#DFDDD6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t mt-2">
                <button
                  type="button"
                  onClick={() => setShowRoomModal(false)}
                  className="px-4 py-2 font-bold text-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#1C2955] text-white font-bold rounded-xl"
                >
                  Simpan Ruangan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
