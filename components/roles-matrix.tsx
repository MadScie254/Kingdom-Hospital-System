"use client";
import { Check } from "lucide-react";
import { ACCESS_ROWS, canOpen, ROLES, ROLE_LABEL } from "@/lib/access";

/** Plain table of which screens each role can open, drawn from the same rules the server enforces. */
export function RolesMatrix() {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">What each role can open</h2>
          <p className="text-xs text-muted">Access follows the role you give a person. Departments say where someone works. They do not change what the person can see.</p>
        </div>
      </div>
      <div className="scroll-thin relative overflow-x-auto">
        <table className="tbl">
          <thead><tr><th className="min-w-[220px]">Area</th>{ROLES.map((r) => <th key={r} className="min-w-[96px] whitespace-normal text-center">{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody>
            {ACCESS_ROWS.map((row) => (
              <tr key={row.path}>
                <td>{row.label}</td>
                {ROLES.map((r) => (
                  <td key={r} className="text-center">
                    {canOpen(r, row.path) ? <><Check size={15} className="mx-auto text-ok" aria-hidden /><span className="sr-only">Allowed</span></> : <span className="sr-only">No access</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
