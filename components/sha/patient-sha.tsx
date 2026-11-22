"use client";
import Link from "next/link";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { HIE_ROLES } from "@/lib/access";
import { useUser } from "@/lib/store";
import { Drawer } from "@/components/ui";
import { ErrorLine, useStep } from "./common";
import { EligibilityCard, guessId, type Elig } from "./visit-wizard";

/** On the patient profile: anyone who treats or registers patients can check SHA cover. Claims staff can also start a visit. */
export function PatientSha({ patient }: { patient: Record<string, any> }) {
  const role = useUser()?.role;
  const { busy, error, run } = useStep();
  const [open, setOpen] = useState(false);
  const [elig, setElig] = useState<Elig | null>(null);
  if (!role || !HIE_ROLES.lookup.includes(role)) return null;
  const [type, number] = guessId(patient);
  const check = async () => {
    setOpen(true); setElig(null);
    if (!number) return;
    const r = await run("elig", "eligibility.check", { identificationType: type, identificationNumber: number, patientId: patient.id });
    if (r) setElig(r.eligibility as Elig);
  };
  return (
    <>
      <button className="btn btn-secondary" onClick={check}><ShieldCheck size={15} />Check SHA cover</button>
      {HIE_ROLES.claim.includes(role) && <Link href={`/sha?patient=${patient.id}`} className="btn btn-secondary">Start SHA visit</Link>}
      <Drawer open={open} onClose={() => setOpen(false)} title="SHA cover" subtitle={patient.name} width={520}>
        <div className="space-y-4">
          {!number && <p className="text-[13px] text-muted">This patient has no ID number or SHA number on record. Add one on the patient&apos;s details, then check again.</p>}
          {number && !elig && !error && <p className="text-[13px] text-muted">{busy ? "Asking SHA" : ""}</p>}
          <ErrorLine text={error} />
          {elig && <EligibilityCard e={elig} />}
          {elig && <p className="text-xs text-muted">Checked just now. The SHA number was saved on the patient.</p>}
        </div>
      </Drawer>
    </>
  );
}
