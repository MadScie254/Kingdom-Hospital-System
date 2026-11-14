"use client";
import { PageHeader } from "@/components/ui";
import { StaffManager } from "@/components/staff";
import { RolesMatrix } from "@/components/roles-matrix";
import { useUser } from "@/lib/store";

export default function StaffPage() {
  const user = useUser();
  return (
    <div>
      <PageHeader title="Staff accounts" description="Approve people who ask for access, give them a role and departments, and manage who can sign in." crumbs={[{ label: "Administration" }, { label: "Staff accounts" }]} />
      {user && <StaffManager selfId={user.id} />}
      <div className="mt-6"><RolesMatrix /></div>
    </div>
  );
}
