"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Info, RefreshCw } from "lucide-react";
import { Badge, Empty, PageHeader, toast } from "@/components/ui";
import { useDB, useStatus } from "@/lib/store";
import { fmtDateTime, kes } from "@/lib/format";
import { BillingCard, PreauthCard, ServicesCard, claimEditable } from "@/components/sha/claim-parts";
import { CloseCard, IdentifyCard, StartVisitCard, SubmitCard } from "@/components/sha/claim-finish";
import { ErrorLine, SCENARIO_LABEL, SERVICE_LABEL, Section, timeLeft, useStep } from "@/components/sha/common";

type Json = Record<string, any>;
const SENT = ["Submitted", "Under review", "Needs action", "Approved", "Sent for payment", "Paid", "Rejected", "Failed to submit", "Closed", "Time barred"];

export default function ClaimPage() {
  const { id } = useParams<{ id: string }>();
  const d = useDB();
  const status = useStatus();
  const claim = d.shaClaims.find((c) => c.id === Number(id));
  const { busy, error, run } = useStep();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  if (!claim) return <div><PageHeader title="SHA claim" crumbs={[{ label: "SHA", href: "/sha" }, { label: "Not found" }]} />{status === "ready" ? <Empty title="This claim was not found" hint="It may have been removed, or the address is wrong." action={<Link href="/sha" className="btn btn-primary">Back to SHA</Link>} /> : <p className="text-[13px] text-muted">Loading</p>}</div>;

  const live = claim.source === "hie";
  const patient = claim.patientId ? d.patients.find((p) => p.id === claim.patientId) : null;
  const editable = claimEditable(claim);
  const sent = SENT.includes(claim.status);
  const emergencyOpen = claim.serviceType === "EMERGENCY" && claim.emergency?.deadline && !sent;
  const left = emergencyOpen ? timeLeft(claim.emergency.deadline, now) : null;
  const refresh = async () => { const r = await run("refresh", "claim.refresh", { claimId: claim.id }); if (r) toast("Read the latest from SHA"); };

  return (
    <div className="space-y-5">
      <PageHeader title={`Claim ${claim.claimNo}`} crumbs={[{ label: "SHA", href: "/sha" }, { label: claim.claimNo }]}
        description={[SERVICE_LABEL[claim.serviceType], claim.intervention].filter(Boolean).join(", ")}
        actions={live && <button className="btn btn-secondary" onClick={refresh} disabled={!!busy}><RefreshCw size={15} />{busy === "refresh" ? "Reading" : "Refresh from SHA"}</button>} />
      <ErrorLine text={error} />

      {!live && <p className="flex items-start gap-2 rounded-md bg-surface px-4 py-3 text-[13px] text-muted"><Info size={16} className="mt-0.5 shrink-0" />This record was entered before the SHA link was set up. It was not sent through SHA, so SHA has not confirmed its status. It is shown here for reference only.</p>}
      {left && <p className={`flex items-start gap-2 rounded-md px-4 py-3 text-[13px] ${left.tone === "bad" ? "bg-bad-50 text-bad" : left.tone === "warn" ? "bg-warn-50 text-warn" : "bg-surface text-muted"}`}><Clock size={16} className="mt-0.5 shrink-0" /><span><strong>Emergency claim: {left.text}.</strong> It must reach SHA within 24 hours of arrival, by {fmtDateTime(new Date(new Date(claim.emergency.deadline).getTime() + 3 * 3600e3).toISOString().slice(0, 16))}.</span></p>}
      {claim.remarks && <p className="flex items-start gap-2 rounded-md bg-warn-50 px-4 py-3 text-[13px] text-warn"><AlertTriangle size={16} className="mt-0.5 shrink-0" /><span><strong>SHA says:</strong> {claim.remarks}</span></p>}

      <Section title="Visit summary" actions={<Badge tone={claim.statusTone || "mute"}>{claim.status || "Unknown"}</Badge>}>
        <dl className="grid gap-x-8 gap-y-4 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-xs text-muted">Patient</dt><dd className="mt-0.5 font-medium">{patient ? <Link href={`/patients/${patient.id}`} className="hover:underline">{patient.name}</Link> : claim.serviceType === "EMERGENCY" ? "Not identified yet" : "Unknown patient"}</dd>{claim.crId && <dd className="font-mono text-xs text-muted">{claim.crId}</dd>}</div>
          <div><dt className="text-xs text-muted">Kind of visit</dt><dd className="mt-0.5">{SERVICE_LABEL[claim.serviceType] || "Earlier record"}</dd>{claim.flow?.scenario && <dd className="text-xs text-muted">{SCENARIO_LABEL[claim.flow.scenario]}</dd>}</div>
          <div><dt className="text-xs text-muted">Fund and scheme</dt><dd className="mt-0.5">{[claim.fund, claim.scheme].filter(Boolean).join(", ") || "Not stated"}</dd></div>
          <div><dt className="text-xs text-muted">Visit number at SHA</dt><dd className="mt-0.5 font-mono">{claim.visitNumber || "Not issued yet"}</dd></div>
          <div><dt className="text-xs text-muted">Visit started</dt><dd className="mt-0.5">{claim.visitStart ? fmtDateTime(new Date(new Date(claim.visitStart).getTime() + 3 * 3600e3).toISOString().slice(0, 16)) : "Not started"}</dd></div>
          <div><dt className="text-xs text-muted">Invoice</dt><dd className="mt-0.5">{claim.invoiceNo ? <Link href={`/billing/${claim.invoiceNo}`} className="text-brand hover:underline">{claim.invoiceNo}</Link> : "Not chosen yet"}</dd></div>
          <div><dt className="text-xs text-muted">Claim total</dt><dd className="mt-0.5 font-semibold tabular-nums">{kes(Number(claim.amount) || 0, 2)}</dd></div>
          {live && (
            <div className="sm:col-span-2 lg:col-span-3">
              <dt className="text-xs text-muted">What SHA reports</dt>
              <dd className="mt-1 flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs text-muted">
                <span>Claim: {claim.workflowState || "none yet"}</span><span>Visit: {claim.authStatus || "none yet"}</span><span>Payer: {claim.payerState || "not reviewed yet"}</span>
                {claim.lastSyncedAt && <span>Last read {fmtDateTime(new Date(new Date(claim.lastSyncedAt).getTime() + 3 * 3600e3).toISOString().slice(0, 16))}</span>}
              </dd>
            </div>
          )}
        </dl>
        {live && sent && <p className="text-[13px] text-muted">SHA now holds this claim. Nothing here can change it. Press Refresh from SHA to read the latest, or wait: SHA also sends updates by itself. Act only if the status says Needs action.</p>}
      </Section>

      {live && claim.status === "Awaiting visit" && <StartVisitCard claim={claim} />}
      {live && <ServicesCard claim={claim} />}
      {live && <PreauthCard claim={claim} />}
      {live && claim.status !== "Awaiting visit" && <BillingCard claim={claim} />}
      {live && claim.serviceType === "EMERGENCY" && !claim.emergency?.identified && editable && <IdentifyCard claim={claim} />}
      {live && editable && <SubmitCard claim={claim} />}
      {live && <CloseCard claim={claim} />}
    </div>
  );
}
