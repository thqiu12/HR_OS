import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasRole, canEditMaster } from "@/lib/permissions";
import { Forbidden } from "@/components/ui";
import PayrollClient from "./client";

export const dynamic = "force-dynamic";

export default async function PayrollPage({ params }: { params: { ym: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasRole(session, "group_admin") && !canEditMaster(session) && !hasRole(session, "school_hr")) {
    return <Forbidden message="給与計算は HR のみ" />;
  }
  if (!/^\d{4}-\d{2}$/.test(params.ym)) redirect("/staffing/payroll");

  const period = db.payrollPeriodByYearMonth(params.ym);
  const lines: any[] = period ? (db.linesByPeriod(period.id) as any[]) : [];

  return <PayrollClient yearMonth={params.ym} period={period} lines={lines} />;
}
