"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useDB, useLookup } from "@/lib/store";
import { DocFooter, DocHeader } from "@/components/documents";
import { age, fmtDate } from "@/lib/format";

export default function PrescriptionPrint() {
  const { id } = useParams<{ id: string }>();
  const d = useDB();
  const L = useLookup();
  const rx = d.prescriptions.find((r) => r.id === Number(id));
  if (!rx) { if (d.prescriptions.length) notFound(); return null; }
  const p = L.patient(rx.patientId);
  const doc = L.doctor(rx.doctorId);
  return (
    <div>
      <div className="no-print mb-5 flex items-center justify-between"><div className="flex items-center gap-3"><Link href="/prescriptions" className="btn btn-secondary btn-icon" aria-label="Back"><ArrowLeft size={16} /></Link><h1 className="text-xl font-semibold">Prescription</h1></div><button className="btn btn-primary" onClick={() => window.print()}><Printer size={15} />Print</button></div>
      <article className="print-sheet mx-auto max-w-[760px] rounded-[10px] border border-line bg-white p-5 shadow-[0_2px_18px_rgba(11, 43, 38,0.07)] sm:p-10 sm:shadow-[0_2px_18px_rgba(11, 43, 38,0.07)]">
        <DocHeader title="Prescription" lines={[{ k: "Number", v: `RX${String(rx.id).padStart(4, "0")}` }, { k: "Date", v: fmtDate(rx.date) }]} />
        <section className="mt-6 grid grid-cols-1 gap-6 text-[13px] sm:grid-cols-2"><div><div className="text-xs text-muted">Patient</div><div className="text-[15px] font-semibold">{p?.name}</div><div className="text-muted">{p?.mrn}, {p ? `${age(p.dob)} years, ${p.gender}` : ""}</div>{p?.allergies && p.allergies !== "None known" && <div className="mt-1 font-medium text-bad">Allergy: {p.allergies}</div>}</div><div><div className="text-xs text-muted">Prescriber</div><div className="text-[15px] font-semibold">{doc?.name}</div><div className="text-muted">{doc?.specialty}, {doc?.licence}</div></div></section>
        <div className="mt-8 text-4xl font-semibold text-brand" aria-hidden>Rx</div>
        <table className="mt-3 w-full text-[13px]"><thead><tr className="border-b-2 border-brand text-left text-xs font-semibold text-muted"><th className="pb-2">Medicine</th><th className="pb-2">Dose</th><th className="pb-2">Frequency</th><th className="pb-2 text-right">Days</th></tr></thead><tbody>{rx.items.map((i: any, k: number) => <tr key={k} className="border-b border-line-2"><td className="py-3 font-medium">{i.medicine}</td><td className="py-3">{i.dose}</td><td className="py-3">{i.frequency}</td><td className="py-3 text-right tabular-nums">{i.days}</td></tr>)}</tbody></table>
        {rx.notes && <p className="mt-5 text-[13px]"><strong>Instructions:</strong> {rx.notes}</p>}
        <div className="mt-14 grid grid-cols-2 gap-10 text-[13px]"><div className="border-t border-line pt-2 text-muted">Prescriber signature and stamp</div><div className="border-t border-line pt-2 text-muted">Dispensed by</div></div>
        <DocFooter>This prescription is valid for 30 days from the date of issue.</DocFooter>
      </article>
    </div>
  );
}
