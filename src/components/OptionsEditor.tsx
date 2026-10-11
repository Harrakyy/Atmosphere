"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const MAX_OPTIONS = 10; // sama dengan batas di adminProductSchema

interface OptionsEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
}

// Editor pilihan produk (Hot/Ice, saos, rasa): satu chip per pilihan, Enter menambah
export function OptionsEditor({ value, onChange }: OptionsEditorProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const option = draft.trim();
    if (!option) return;
    if (value.length >= MAX_OPTIONS) return setError(`Maksimal ${MAX_OPTIONS} pilihan.`);
    if (value.some((o) => o.toLowerCase() === option.toLowerCase())) return setError(`"${option}" sudah ada.`);
    onChange([...value, option]);
    setDraft("");
    setError(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((option) => (
            <Badge key={option} variant="secondary" className="gap-1 pr-1">
              {option}
              <button
                type="button"
                aria-label={`Hapus opsi ${option}`}
                onClick={() => onChange(value.filter((o) => o !== option))}
                className="rounded-full p-0.5 hover:bg-black/10"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault(); // Enter tidak boleh men-submit form produk
              add();
            }
          }}
          placeholder="Contoh: Hot, lalu Enter"
          aria-label="Tambah pilihan produk"
        />
        <Button type="button" variant="outline" onClick={add}>
          <Plus /> Tambah
        </Button>
      </div>
      {error && <span className="text-[11px] text-destructive">{error}</span>}
    </div>
  );
}
