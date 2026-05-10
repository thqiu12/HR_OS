import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canEditMaster } from "@/lib/permissions";
import SchoolsClient from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canEditMaster(session)) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
        <p className="text-sm text-slate-500 mt-2">学校マスタはグループ管理者または法人HRのみ。</p>
      </div>
    );
  }
  const schools: any[] = db.schools();
  const departments: any[] = db.departments();
  const employees: any[] = db.employees();
  const enriched = schools.map((s) => ({
    ...s,
    deptCount: departments.filter((d) => d.schoolId === s.id).length,
    empCount: employees.filter((e) => e.schoolId === s.id).length,
  }));
  return <SchoolsClient schools={enriched} />;
}
