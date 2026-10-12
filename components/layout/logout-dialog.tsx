"use client";

import { useFormStatus } from "react-dom";
import { logout } from "@/app/actions/auth";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Keluar…" : "Keluar"}
    </Button>
  );
}

/** Konfirmasi logout — dipakai di menu user sidebar, header moderator & halaman pending. */
export function LogoutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Keluar dari aplikasi?</AlertDialogTitle>
          <AlertDialogDescription>Anda perlu login lagi untuk melanjutkan.</AlertDialogDescription>
        </AlertDialogHeader>
        <form action={logout}>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Batal</AlertDialogCancel>
            <SubmitButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
