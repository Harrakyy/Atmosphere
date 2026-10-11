"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmRequest {
  title: string;
  description?: string;
  resolve: (ok: boolean) => void;
}

// Pengganti window.confirm(): `if (!(await askConfirm("Hapus?"))) return;` + render `confirmDialog` sekali di halaman
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const askConfirm = (title: string, description?: string) =>
    new Promise<boolean>((resolve) => setRequest({ title, description, resolve }));

  const close = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };

  const confirmDialog = (
    <AlertDialog open={request !== null} onOpenChange={(open) => !open && close(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          {request?.description && <AlertDialogDescription>{request.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => close(true)}>
            Ya, Lanjutkan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { askConfirm, confirmDialog };
}
