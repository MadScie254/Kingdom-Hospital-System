"use client";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { db, useUser } from "@/lib/store";
import { toast } from "./ui";
import type { Row } from "@/lib/collections";

/** Administrators can check a doctor's registration number against the SHA health worker register. The answer is saved on the doctor. */
export function VerifyPractitioner({ row }: { row: Row }) {
  const user = useUser();
  const [busy, setBusy] = useState(false);
  if (user?.role !== "admin") return null;
  const run = async () => {
    if (!row.licence) { toast("Add this doctor's registration number first."); return; }
    setBusy(true);
    const r = await db.hie("practitioner.verify", { doctorId: row.id });
    setBusy(false);
    if (!r) return;
    toast(r.status ? `${r.name || row.name}: ${String(r.status).toLowerCase()} on the SHA register` : `${r.name || row.name} was found on the SHA register`);
  };
  return <button className="btn btn-ghost btn-sm btn-icon" aria-label={`Check ${row.name} on the SHA register`} title="Check on the SHA register" onClick={run} disabled={busy}><BadgeCheck size={15} /></button>;
}
