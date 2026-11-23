const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function wrap(heading: string, paragraphs: string[], extra = "", button?: { label: string; href: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#18222b">${p}</p>`).join("");
  const btn = button ? `<p style="margin:22px 0"><a href="${esc(button.href)}" style="background:#2a6fae;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;display:inline-block">${esc(button.label)}</a></p>` : "";
  return `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px"><div style="font-size:13px;color:#2a6fae;font-weight:600;margin-bottom:6px">Kingdom Faith Based Hospital</div><h1 style="font-size:20px;margin:0 0 16px;color:#18222b">${esc(heading)}</h1>${body}${extra}${btn}<p style="margin:26px 0 0;font-size:12px;color:#68737d">This message was sent by the hospital system. If you did not expect it, you can ignore it.</p></div>`;
}
const box = (label: string, value: string) => `<div style="margin:0 0 16px;padding:14px 16px;background:#eaf3fb;border-radius:8px"><div style="font-size:12px;color:#59646e;margin-bottom:4px">${esc(label)}</div><div style="font-family:Consolas,monospace;font-size:20px;letter-spacing:1px;color:#18222b">${esc(value)}</div></div>`;

export const emails = {
  accessRequest: (d: { name: string; position: string; email: string; phone: string; departments: string[]; origin: string }) => ({
    subject: `Access request: ${d.name}, ${d.position}`,
    html: wrap("Someone asked for access", [`<strong>${esc(d.name)}</strong> asked to join as ${esc(d.position)}.`, `Email: ${esc(d.email)}${d.phone ? `<br>Phone: ${esc(d.phone)}` : ""}<br>Departments: ${esc(d.departments.join(", ") || "none chosen")}`, "Open Staff accounts to confirm their role and departments, then approve or decline."], "", { label: "Review the request", href: `${d.origin}/staff` }),
    text: `${d.name} asked to join as ${d.position}. Email: ${d.email}. Departments: ${d.departments.join(", ")}. Review: ${d.origin}/staff`,
  }),
  credentials: (d: { reason: "approved" | "created" | "reset"; name: string; roleLabel: string; departments: string[]; tempPassword: string; origin: string }) => {
    const intro = d.reason === "approved" ? "Your request for access was approved." : d.reason === "created" ? "The hospital administrator created an account for you." : "The hospital administrator set a new temporary password for your account.";
    const subject = d.reason === "reset" ? "Your temporary password for Kingdom Faith Based Hospital" : "Your access to Kingdom Faith Based Hospital is ready";
    return {
      subject,
      html: wrap(`Hello, ${d.name.split(" ")[0]}`, [intro, `Role: <strong>${esc(d.roleLabel)}</strong><br>Departments: ${esc(d.departments.join(", ") || "none yet")}`, "Sign in with this email address and the temporary password below. You will be asked to choose your own password straight away."], box("Temporary password", d.tempPassword), { label: "Sign in", href: `${d.origin}/login` }),
      text: `${intro} Role: ${d.roleLabel}. Sign in at ${d.origin}/login with this email address and the temporary password ${d.tempPassword}. You will choose your own password straight away.`,
    };
  },
  declined: (d: { name: string; contact: string }) => ({
    subject: "Your access request was not approved",
    html: wrap("Request not approved", [`Hello ${esc(d.name)}, the hospital administrator did not approve your access request.`, `If you think this is a mistake, please contact the hospital${d.contact ? ` on ${esc(d.contact)}` : ""}.`]),
    text: `Hello ${d.name}, your access request was not approved. ${d.contact ? `Contact the hospital: ${d.contact}.` : ""}`,
  }),
  reset: (d: { name: string; link: string }) => ({
    subject: "Reset your Kingdom Faith Based Hospital password",
    html: wrap("Choose a new password", [`Hello ${esc(d.name)}, we received a request to reset your password.`, "Use the button below within one hour. If you did not ask for this, ignore this email and your password stays the same."], "", { label: "Choose a new password", href: d.link }),
    text: `Hello ${d.name}, choose a new password within one hour: ${d.link}`,
  }),
  backupFailed: (d: { error: string }) => ({
    subject: "The nightly backup failed",
    html: wrap("Nightly backup failed", ["The hospital system could not save last night's backup.", `Reason: ${esc(d.error)}`, "Open Settings, Backups and press Back up now. If it fails again, contact the person who set up the system."]),
    text: `The nightly backup failed. Reason: ${d.error}. Open Settings, Backups and press Back up now.`,
  }),
  auditFailed: (d: { what: string; error: string }) => ({
    subject: "A SHA audit record could not be saved",
    html: wrap("SHA audit record not saved", ["The hospital system could not write part of its record of work done with SHA.", `Where: ${esc(d.what)}`, `Reason: ${esc(d.error)}`, "The step with SHA itself went through. Check the database connection, then look at Settings, SHA connection for gaps in the call log. DHA can ask to see that log."]),
    text: `A SHA audit record could not be saved. Where: ${d.what}. Reason: ${d.error}. The step with SHA itself went through. Check the database connection and the call log in Settings, SHA connection.`,
  }),
  test: () => ({
    subject: "Test email from the hospital system",
    html: wrap("Email is working", ["This is a test message. Alerts, approvals and password resets will arrive the same way."]),
    text: "This is a test message. Email is working.",
  }),
};
