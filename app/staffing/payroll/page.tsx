import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasRole, canEditMaster } from "@/lib/permissions";
import { Card, CardHeader, Badge, Forbidden } from "@/components/ui";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, any> = { open: "amber", locked: "blue", exported: "emerald" };
const STATUS_LABEL: Record<string, string> = { open: "計算中", locked: "確定", exported: "出力済" };

export default async function PayrollIndexPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasRole(session, "group_admin") && !canEditMaster(session) && !hasRole(session, "school_hr")) {
    return <Forbidden message="給与計算は HR のみ" />;
  }

  const periods = db.allPayrollPeriods(24) as any[];
  const today = new Date();
  const currentYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <CardHeader
          title="💰 給与計算 期間一覧"
          subtitle="月単位の給与計算セッション。シフト確定後に「計算実行」 → 「確定」 → 「CSV出力」"
          right={
            <Link href={`/staffing/payroll/${currentYm}`} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-xs font-medium">
              {currentYm} を開く
            </Link>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-5 py-2">期間</th>
                <th className="text-center px-5 py-2">状態</th>
                <th className="text-right px-5 py-2">対象人数</th>
                <th className="text-right px-5 py-2">合計金額</th>
                <th className="text-left px-5 py-2">確定日</th>
                <th className="text-left px-5 py-2">出力日</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {periods.length === 0 && (
                <tr><td colSpan={7} className="text-center text-sm text-slate-400 py-8">未計算 — 当月から開始してください</td></tr>
              )}
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono">{p.yearMonth}</td>
                  <td className="px-5 py-3 text-center"><Badge tone={STATUS_TONE[p.status]} size="xs">{STATUS_LABEL[p.status]}</Badge></td>
                  <td className="px-5 py-3 text-right">{p.totalEmployees ?? "—"}</td>
                  <td className="px-5 py-3 text-right font-mono">{p.totalAmount ? `¥${p.totalAmount.toLocaleString()}` : "—"}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{p.lockedAt?.slice(0, 10) || "—"}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{p.exportedAt?.slice(0, 10) || "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/staffing/payroll/${p.yearMonth}`} className="text-brand-600 inline-flex items-center text-xs hover:underline">開く<ChevronRight size={14} /></Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
