import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canEditMaster, accessibleSchoolIds, filterSchools, hasRole } from "@/lib/permissions";
import EmployeeNewForm from "./form";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canEditMaster(session) && !hasRole(session, "school_hr")) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
      </div>
    );
  }
  const allowedSchools = filterSchools(session, db.schools());
  const allowedIds = new Set(accessibleSchoolIds(session));
  const allowedDepartments = db.departments().filter((d: any) => allowedIds.has(d.schoolId));
  return <EmployeeNewForm schools={allowedSchools} departments={allowedDepartments} />;
}
