import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canEditMaster, hasRole, filterEmployees, filterSchools } from "@/lib/permissions";
import { Forbidden } from "@/components/ui";
import PatternsClient from "./client";

export const dynamic = "force-dynamic";

export default async function PatternsPage({ searchParams }: { searchParams: { school?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canEditMaster(session) && !hasRole(session, "school_hr")) {
    return <Forbidden message="シフトパターンの編集は HR のみ" />;
  }

  const schools = filterSchools(session, db.schools()) as any[];
  const schoolId = searchParams.school || schools[0]?.id;
  if (!schoolId) return <Forbidden message="編集可能な学校がありません" />;

  const employees = (filterEmployees(session, db.employees()) as any[]).filter((e) => e.schoolId === schoolId);
  const patterns = (db.patternsBySchool(schoolId) as any[]);
  const rateTypes = (db.wageRateTypesFor({ entity: schools.find((s) => s.id === schoolId)?.entity, schoolId }) as any[]).filter((t: any) => t.active);

  return (
    <PatternsClient
      schools={schools}
      currentSchoolId={schoolId}
      employees={employees}
      patterns={patterns.map((p) => ({
        ...p,
        employeeName: employees.find((e: any) => e.id === p.employeeId)?.name || p.employeeId,
        rateTypeName: rateTypes.find((t: any) => t.id === p.rateTypeId)?.name || `#${p.rateTypeId}`,
      }))}
      rateTypes={rateTypes}
    />
  );
}
