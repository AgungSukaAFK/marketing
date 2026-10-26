"use client";

import { startTransition, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { countActivity, purgeActivity } from "@/app/actions/activity";
import { DatePicker } from "@/components/form/date-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { fmtDay, fmtNumber } from "@/lib/format";

/** Hapus permanen log Activity History pada periode tertentu (tanggal WIB, inklusif). */
export function PurgeDialog({
  open,
  onOpenChange,
  onPurged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurged: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [count, setCount] = useState<{ key: string; value: number | null; error: string | null } | null>(null);
  const [checking, startCheck] = useTransition();
  const [purging, startPurge] = useTransition();

  const key = `${from}|${to}`;
  const invalid = !!from && !!to && from > to;

  // Pratinjau jumlah log setiap periode berubah
  useEffect(() => {
    if (!open || !to || invalid) return;
    const k = `${from}|${to}`;
    startCheck(async () => {
      const res = await countActivity({ from: from || null, to });
      startTransition(() => setCount({ key: k, value: res.ok ? res.data! : null, error: res.ok ? null : res.error }));
    });
  }, [open, from, to, invalid]);

  const current = count?.key === key ? count : null;
  const period = `${from ? fmtDay(from) : "log pertama"} – ${to ? fmtDay(to) : "…"}`;

  const close = (o: boolean) => {
    if (purging) return;
    if (!o) {
      setFrom("");
      setTo("");
      setCount(null);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hapus Log Activity History</DialogTitle>
          <DialogDescription>Log pada periode yang dipilih dihapus permanen beserta rinciannya.</DialogDescription>
        </DialogHeader>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="purge-from">Dari tanggal</FieldLabel>
              <DatePicker id="purge-from" value={from} onChange={setFrom} minYear={2020} />
              <FieldDescription>Kosongkan = sejak log pertama</FieldDescription>
            </Field>
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor="purge-to">Sampai tanggal</FieldLabel>
              <DatePicker id="purge-to" value={to} onChange={setTo} invalid={invalid} minYear={2020} />
              <FieldDescription>{invalid ? "Harus setelah tanggal awal" : "Termasuk tanggal ini"}</FieldDescription>
            </Field>
          </div>
          {to && !invalid && (
            <Alert variant={current?.value ? "destructive" : "default"}>
              <AlertDescription>
                {checking || !current
                  ? "Menghitung log…"
                  : current.error
                    ? current.error
                    : current.value
                      ? `${fmtNumber(current.value)} log (${period}) akan dihapus permanen dan tidak bisa dikembalikan. Penghapusan ini sendiri tetap tercatat.`
                      : `Tidak ada log pada periode ${period}.`}
              </AlertDescription>
            </Alert>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={purging}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={!current?.value || checking || purging}
            onClick={() =>
              startPurge(async () => {
                const res = await purgeActivity({ from: from || null, to });
                if (!res.ok) return void toast.error(res.error);
                toast.success(res.message);
                close(false);
                onPurged();
              })
            }
          >
            {current?.value ? `Hapus ${fmtNumber(current.value)} log` : "Hapus"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
