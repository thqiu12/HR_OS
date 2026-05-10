import { db } from "@/lib/db";
import { auth } from "@/auth";
import { filterEmployees, filterSchools, accessibleSchoolIds, canEditMaster, hasRole } from "@/lib/permissions";
import { redirect } from "next/navigation";
import OrgTreeClient from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  const schools = filterSchools(session, db.schools());
  const allowedIds = new Set(accessibleSchoolIds(session));
  const departments = db.departments().filter((d: any) => allowedIds.has(d.schoolId));
  const employees = filterEmployees(session, db.employees());
  const canEdit = canEditMaster(session) || hasRole(session, "school_hr");
  return <OrgTreeClient schools={schools} departments={departments} employees={employees} canEdit={canEdit} />;
}
