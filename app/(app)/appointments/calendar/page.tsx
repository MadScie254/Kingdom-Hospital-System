"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import clsx from "clsx";
import { useDB, useLookup } from "@/lib/store";
import { PageHeader } from "@/components/ui";
import { ANCHOR, addDays, dayName, fmtDate, fmtShort, fmtTime } from "@/lib/format";

const H0 = 8, H1 = 18, ROW = 60;
const TONE: Record<string, string> = { Confirmed: "border-brand bg-brand-50 text-brand", Pending: "border-warn bg-warn-50 text-warn", Requested: "border-warn bg-warn-50 text-warn", Treated: "border-ok bg-ok-50 text-ok", Cancelled: "border-line bg-surface text-faint line-through" };

export default function CalendarPage() {
  const d = useDB();
  const L = useLookup();
  const [off, setOff] = useState(0);
  const [doc, setDoc] = useState("");
  const dow = (new Date(ANCHOR + "T00:00:00Z").getUTCDay() + 6) % 7;
  const start = addDays(ANCHOR, -dow + off * 7);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const lanes = useMemo(() => {
    const out: Record<string, { a: any; lane: number; n: number }[]> = {};
    days.forEach((day) => {
      const list = d.appointments.filter((a) => a.date.startsWith(day) && (!doc || a.doctorId === Number(doc))).sort((a, b) => a.date.localeCompare(b.date));
      const ends: number[] = [];
      const placed = list.map((a) => {
        const s = Number(a.date.slice(11, 13)) * 60 + Number(a.date.slice(14, 16));
        let lane = ends.findIndex((e) => e <= s); if (lane < 0) lane = ends.length;
        ends[lane] = s + (a.duration || 30);
        return { a, lane, n: 0 };
      });
      placed.forEach((p) => (p.n = Math.max(ends.length, 1)));
      out[day] = placed;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.appointments, start, doc]);

  return (
    <div>
      <PageHeader title="Appointment calendar" crumbs={[{ label: "Appointments", href: "/appointments" }, { label: "Calendar" }]} description="Weekly view of every booking. Overlapping bookings for different doctors sit side by side."
        actions={<>
          <select className="input w-auto" value={doc} onChange={(e) => setDoc(e.target.value)} aria-label="Doctor"><option value="">All doctors</option>{d.doctors.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <div className="flex items-center gap-1"><button className="btn btn-secondary btn-icon" onClick={() => setOff(off - 1)} aria-label="Previous week"><ChevronLeft size={16} /></button><button className="btn btn-secondary" onClick={() => setOff(0)}>This week</button><button className="btn btn-secondary btn-icon" onClick={() => setOff(off + 1)} aria-label="Next week"><ChevronRight size={16} /></button></div>
        </>} />
      <div className="mb-3 text-[13px] font-medium">{fmtDate(days[0])} to {fmtDate(days[6])}</div>
      <section className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <div className="min-w-[860px]">
            <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-line bg-[#f7f8fa]">
              <div />
              {days.map((day) => (<div key={day} className={clsx("border-l border-line-2 px-3 py-2.5 text-center", day === ANCHOR && "bg-brand-50")}><div className="text-xs text-muted">{dayName(day)}</div><div className={clsx("text-[15px] font-semibold", day === ANCHOR && "text-brand")}>{fmtShort(day)}</div></div>))}
            </div>
            <div className="relative grid grid-cols-[56px_repeat(7,1fr)]">
              <div>{Array.from({ length: H1 - H0 }, (_, i) => <div key={i} style={{ height: ROW }} className="pr-2 text-right text-xs tabular-nums text-faint"><span className="relative -top-2">{String(H0 + i).padStart(2, "0")}:00</span></div>)}</div>
              {days.map((day) => (
                <div key={day} className={clsx("relative border-l border-line-2", day === ANCHOR && "bg-[#f6faff]")} style={{ height: (H1 - H0) * ROW }}>
                  {Array.from({ length: H1 - H0 }, (_, i) => <div key={i} style={{ height: ROW }} className="border-b border-line-2" />)}
                  {lanes[day].map(({ a, lane, n }) => {
                    const mins = Number(a.date.slice(11, 13)) * 60 + Number(a.date.slice(14, 16)) - H0 * 60;
                    const h = Math.max(((a.duration || 30) / 60) * ROW - 3, 24);
                    return (
                      <Link key={a.id} href={`/patients/${a.patientId}`} title={`${L.patientName(a.patientId)} with ${L.doctorName(a.doctorId)}`} className={clsx("absolute overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-[11.5px] leading-tight hover:shadow-md", TONE[a.status] || TONE.Confirmed)}
                        style={{ top: (mins / 60) * ROW + 1, height: h, left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }}>
                        <div className="truncate font-semibold">{fmtTime(a.date)} {L.patientName(a.patientId)}</div>
                        {h > 34 && <div className="truncate opacity-80">{L.doctorName(a.doctorId)}</div>}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">{["Confirmed", "Pending", "Treated", "Cancelled"].map((s) => <li key={s} className="flex items-center gap-1.5"><span className={clsx("h-3 w-1 rounded-sm border-l-[3px]", TONE[s].split(" ")[0])} />{s}</li>)}</ul>
    </div>
  );
}
