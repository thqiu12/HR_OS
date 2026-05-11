import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { canEditMaster, hasRole, filterEmployees, filterSchools } from "@/lib/permissions";
import { Card, CardHeader, Forbidden } from "@/components/ui";
import ShiftsClient from "./client";

export const dynamic = "force-dynamic";

export default async function ShiftsPage({ searchParams }: { searchParams: { ym?: string; school?: string; emp?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canEditMaster(session) && !hasRole(session, "school_hr") && !hasRole(session, "principal") && !hasRole(session, "manager")) {
    return <Forbidden message="シフト管理は HR / 部門長のみ" />;
  }

  // Default to current month
  const today = new Date();
  const ym = searchParams.ym || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  if (!/^\d{4}-\d{2}$/.test(ym)) redirect("/staffing/shifts");

  const schools = filterSchools(session, db.schools()) as any[];
  const schoolId = searchParams.school || schools[0]?.id;
  const employees = (filterEmployees(session, db.employees()) as any[]).filter((e: any) => !schoolId || e.schoolId === schoolId);

  // Pull the month's shifts for the selected school (or all)
  let shifts: any[] = [];
  if (schoolId) {
    shifts = db.shiftsBySchoolMonth(schoolId, ym) as any[];
    if (searchParams.emp) shifts = shifts.filter((s) => s.employeeId === searchParams.emp);
  }

  // Get rate types so we can show the rate name
  const rateTypes = db.allWageRateTypes() as any[];
  const rtName = (id: number) => rateTypes.find((t) => t.id === id)?.name || `#${id}`;

  return (
    <ShiftsClient
      yearMonth={ym}
      schools={schools}
      currentSchoolId={schoolId || ""}
      employees={employees}
      currentEmpId={searchParams.emp || ""}
      shifts={shifts.map((s) => ({
        ...s,
        rateTypeName: rtName(s.rateTypeId),
        employeeName: employees.find((e: any) => e.id === s.employeeId)?.name || s.employeeId,
      }))}
    />
  );
}
