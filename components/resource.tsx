"use client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useMemo, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { RESOURCES, type Ctx, type FieldDef, type ResourceDef } from "@/lib/registry";
import { canWrite } from "@/lib/access";
import { db, useDB, useLookup, useUser } from "@/lib/store";
import type { Row } from "@/lib/seed";
import { DataTable, Drawer, Field, FormGrid, PageHeader, Stat, Tabs, toast, useConfirm, type Col } from "./ui";

function optionsFor(from: FieldDef["from"], d: ReturnType<typeof useDB>) {
  if (from === "patients") return d.patients.map((p) => ({ value: p.id, label: `${p.name} (${p.mrn})` }));
  if (from === "doctors") return d.doctors.map((p) => ({ value: p.id, label: p.name }));
  if (from === "departments") return d.departments.map((p) => ({ value: p.id, label: p.name }));
  if (from === "ambulances") return d.ambulances.map((p) => ({ value: p.id, label: `${p.plate}, ${p.type}` }));
  if (from === "medicines") return d.medicines.map((p) => ({ value: p.id, label: p.name }));
  return [];
}

function GenericForm({ def, initial, onClose }: { def: ResourceDef; initial: Row | null; onClose: () => void }) {
  const d = useDB();
  const fields = def.fields || [];
  const [v, setV] = useState<Record<string, any>>(() => ({ ...(def.defaults || {}), ...(initial || {}) }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (n: string, x: any) => setV((s) => ({ ...s, [n]: x }));

  const save = async () => {
    const errs: Record<string, string> = {};
    fields.forEach((f) => { if (f.required && (v[f.name] === undefined || v[f.name] === null || String(v[f.name]).trim() === "")) errs[f.name] = `Enter ${f.label.toLowerCase()}`; });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const out: Record<string, any> = { ...v };
    fields.forEach((f) => {
      if (f.type === "number") out[f.name] = v[f.name] === "" || v[f.name] == null ? null : Number(v[f.name]);
      if (f.from && v[f.name] !== "" && v[f.name] != null) out[f.name] = Number(v[f.name]);
    });
    const saved = initial ? await db.update(def.collection, initial.id, out) : await db.add(def.collection, out);
    if (!saved) return;
    toast(`${def.singular[0].toUpperCase()}${def.singular.slice(1)} ${initial ? "updated" : "added"}`);
    onClose();
  };

  return (
    <Drawer open onClose={onClose} title={initial ? `Edit ${def.singular}` : def.addLabel || `Add ${def.singular}`}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>{initial ? "Save changes" : `Save ${def.singular}`}</button></>}>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <FormGrid>
          {fields.map((f) => {
            const common = { id: `f_${f.name}`, className: "input", value: v[f.name] ?? "", "aria-invalid": !!errors[f.name], placeholder: f.placeholder } as const;
            let control;
            if (f.type === "textarea") control = <textarea {...common} rows={3} onChange={(e) => set(f.name, e.target.value)} />;
            else if (f.type === "select" || f.from) {
              const opts = f.from ? optionsFor(f.from, d) : (f.options || []).map((o) => ({ value: o, label: o }));
              control = <select {...common} onChange={(e) => set(f.name, e.target.value)}><option value="">Select {f.label.toLowerCase()}</option>{opts.map((o) => <option key={String(o.value)} value={o.value}>{o.label}</option>)}</select>;
            } else control = <input {...common} type={f.type || "text"} step={f.type === "number" ? "any" : undefined} onChange={(e) => set(f.name, e.target.value)} />;
            return (
              <Field key={f.name} label={f.label} required={f.required} span={f.span}>
                {control}
                {errors[f.name] && <span className="mt-1 block text-xs text-bad">{errors[f.name]}</span>}
              </Field>
            );
          })}
        </FormGrid>
      </form>
    </Drawer>
  );
}

export function ResourcePage({ k, embedded, def: given }: { k?: string; embedded?: boolean; def?: ResourceDef }) {
  const def = given ?? RESOURCES[k || ""];
  if (!def) notFound();
  return <Inner def={def} embedded={embedded} />;
}

function Inner({ def, embedded }: { def: ResourceDef; embedded?: boolean }) {
  const d = useDB();
  const user = useUser();
  const writable = !def.readOnly && canWrite(user?.role, def.collection);
  const lookup = useLookup();
  const ctx: Ctx = { ...lookup, db: d };
  const all = def.derive ? def.derive(ctx) : (d[def.collection] as Row[]);
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<{ row: Row | null } | null>(null);
  const { ask, node } = useConfirm();

  const tabbed = def.tabs ? all.filter(def.tabs[tab].test) : all;
  const cols = useMemo(() => {
    const base = def.cols(ctx) as Col<Row>[];
    if (!writable && !def.rowHref && !def.extra) return base;
    const actions: Col<Row> = {
      key: "actions", header: "", align: "right", width: 130,
      render: (r) => (
        <div className="flex justify-end gap-1">
          {def.rowHref && <Link href={def.rowHref(r)} className="btn btn-ghost btn-sm btn-icon" aria-label="Open"><Eye size={15} /></Link>}
          {def.extra?.(r, ctx)}
          {writable && !def.noEdit && <button className="btn btn-ghost btn-sm btn-icon" aria-label="Edit" onClick={() => setForm({ row: r })}><Pencil size={15} /></button>}
          {writable && <button className="btn btn-ghost btn-sm btn-icon hover:!text-bad" aria-label="Delete" onClick={() => ask(`Delete this ${def.singular}?`, "This removes the record from the system. It cannot be undone.", async () => { if (await db.remove(def.collection, r.id)) toast(`${def.singular[0].toUpperCase()}${def.singular.slice(1)} deleted`); })}><Trash2 size={15} /></button>}
        </div>
      ),
    };
    return [...base, actions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def, d, writable]);

  const FormC = def.form;
  const addBtn = writable && (def.addHref
    ? <Link href={def.addHref} className="btn btn-primary"><Plus size={16} />{def.addLabel}</Link>
    : <button className="btn btn-primary" onClick={() => setForm({ row: null })}><Plus size={16} />{def.addLabel || `Add ${def.singular}`}</button>);
  const stats = def.stats?.(all, ctx);

  return (
    <div>
      {!embedded && <PageHeader title={def.title} description={def.description} crumbs={def.crumbs || [{ label: def.title }]} actions={addBtn} />}
      {embedded && addBtn && <div className="mb-4 flex justify-end">{addBtn}</div>}
      {stats && <div className="no-print mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map((s, i) => <Stat key={i} {...s} />)}</div>}
      <div className="card overflow-hidden">
        {def.tabs && <div className="px-2"><Tabs tabs={def.tabs.map((t, i) => ({ value: String(i), label: t.label, count: all.filter(t.test).length }))} value={String(tab)} onChange={(v) => setTab(Number(v))} /></div>}
        <DataTable rows={tabbed} cols={cols} exportName={def.title.toLowerCase().replace(/\s+/g, "_")} filters={def.filters?.(ctx)} pageSize={def.pageSize || 10} />
      </div>
      {form && (FormC ? <FormC open initial={form.row} onClose={() => setForm(null)} /> : <GenericForm key={form.row?.id ?? "new"} def={def} initial={form.row} onClose={() => setForm(null)} />)}
      {node}
    </div>
  );
}
