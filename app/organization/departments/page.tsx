import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canEditMaster, accessibleSchoolIds, filterSchools } from "@/lib/permissions";
import DepartmentsClient from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canEditMaster(session)) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
        <p className="text-sm text-slate-500 mt-2">部門管理はグループ管理者または法人HRのみアクセス可能です。</p>
      </div>
    );
  }
  const schools = filterSchools(session, db.schools());
  const allowedIds = new Set(accessibleSchoolIds(session));
  const departments = db.departments().filter((d: any) => allowedIds.has(d.schoolId));
  const employees: any[] = db.employees();
  const empCountByDept = new Map<string, number>();
  for (const e of employees) {
    empCountByDept.set(e.departmentId, (empCountByDept.get(e.departmentId) || 0) + 1);
  }
  const enriched = departments.map((d: any) => ({
    ...d,
    employeeCount: empCountByDept.get(d.id) || 0,
  }));
  return <DepartmentsClient schools={schools} departments={enriched} />;
}
