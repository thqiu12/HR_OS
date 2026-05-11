"use client";
import { Card, CardHeader, Badge } from "@/components/ui";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];
const STATUS_LABEL: Record<string, string> = {
  planned: "予定", confirmed: "確定", completed: "実施済",
  cancelled: "中止", substituted: "代講", paid: "支払済",
};
const STATUS_TONE: Record<string, any> = {
  planned: "slate", confirmed: "blue", completed: "emerald",
  cancelled: "rose", substituted: "amber", paid: "violet",
};

export default function PortalClient({
  employee, yearMonth, shifts, payslips, tokenExpiresAt,
}: {
  employee: { id: string; name: string; empNo: string; employmentType: string; schoolName?: string };
  yearMonth: string;
  shifts: any[];
  payslips: { yearMonth: string; status: string; total: number; lines: any[] }[];
  tokenExpiresAt: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const navMonth = (delta: number) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const newYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    router.push(`${pathname}?ym=${newYm}`);
  };

  const totalHours = shifts.filter((s) => s.status !== "cancelled").reduce((sum, s) => sum + (s.hours || 0), 0);
  const totalAmount = shifts.filter((s) => s.status !== "cancelled").reduce((sum, s) => {
    if (s.rateUnit === "hour") return sum + s.hours * s.rateAmountSnapshot;
    if (s.rateUnit === "class") return sum + s.classes * s.rateAmountSnapshot;
    return sum + s.rateAmountSnapshot;
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <Card>
          <div className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 text-white flex items-center justify-center text-xl">👨‍🏫</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold">{employee.name}</h1>
                <Badge tone="slate" size="xs">{employee.empNo}</Badge>
                <Badge tone="indigo" size="xs">{employee.employmentType}</Badge>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{employee.schoolName} ／ 教員ポータル</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400">リンク有効期限</div>
              <div className="text-xs font-mono text-slate-600">{tokenExpiresAt.slice(0, 10)}</div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title={`📅 シフト ${yearMonth}`}
            subtitle={`${shifts.length} 件 ／ ${totalHours.toFixed(1)}h ／ 概算 ¥${Math.floor(totalAmount).toLocaleString()}`}
            right={
              <div className="flex items-center gap-2">
                <button onClick={() => navMonth(-1)} className="p-1.5 hover:bg-slate-100 rounded"><ChevronLeft size={16} /></button>
                <span className="text-sm font-mono">{yearMonth}</span>
                <button onClick={() => navMonth(1)} className="p-1.5 hover:bg-slate-100 rounded"><ChevronRight size={16} /></button>
              </div>
            }
          />
          {shifts.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">この月のシフトはありません</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-2">日付</th>
                  <th className="text-center px-4 py-2">曜日</th>
                  <th className="text-left px-4 py-2">時間</th>
                  <th className="text-left px-4 py-2">賃率種別</th>
                  <th className="text-right px-4 py-2">時間数</th>
                  <th className="text-right px-4 py-2">概算金額</th>
                  <th className="text-center px-4 py-2">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((s) => {
                  const dow = new Date(s.date).getDay();
                  const amt = s.status === "cancelled" ? 0 :
                    s.rateUnit === "hour" ? s.hours * s.rateAmountSnapshot :
                    s.rateUnit === "class" ? s.classes * s.rateAmountSnapshot : s.rateAmountSnapshot;
                  return (
                    <tr key={s.id} className={s.status === "cancelled" ? "opacity-50" : ""}>
                      <td className="px-4 py-2 font-mono text-xs">{s.date}</td>
                      <td className={`px-4 py-2 text-center text-xs ${dow === 0 ? "text-rose-600" : dow === 6 ? "text-blue-600" : ""}`}>{DOW[dow]}</td>
                      <td className="px-4 py-2 font-mono text-xs">{s.startTime}〜{s.endTime}</td>
                      <td className="px-4 py-2 text-xs">{s.rateTypeName}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs">{s.hours.toFixed(1)}h</td>
                      <td className="px-4 py-2 text-right font-mono">¥{Math.floor(amt).toLocaleString()}</td>
                      <td className="px-4 py-2 text-center"><Badge tone={STATUS_TONE[s.status]} size="xs">{STATUS_LABEL[s.status]}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        {payslips.length > 0 && (
          <Card>
            <CardHeader title="💴 給与明細 (確定済)" subtitle="支払い済 / 確定済の月の明細" />
            <div className="p-4 space-y-3">
              {payslips.map((ps) => (
                <details key={ps.yearMonth} className="border border-slate-100 rounded-lg">
                  <summary className="px-4 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between">
                    <span className="font-mono text-sm">{ps.yearMonth}</span>
                    <div className="flex items-center gap-3">
                      <Badge tone={ps.status === "exported" ? "emerald" : "blue"} size="xs">{ps.status === "exported" ? "支払い済" : "確定"}</Badge>
                      <span className="font-mono font-bold text-emerald-700">¥{ps.total.toLocaleString()}</span>
                    </div>
                  </summary>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-50">
                      {ps.lines.map((l: any) => (
                        <tr key={l.id}>
                          <td className="px-4 py-1.5">{l.rateTypeName}</td>
                          <td className="px-4 py-1.5 text-right font-mono">
                            {l.rateUnit === "hour" ? `${l.hours.toFixed(1)}h` : l.rateUnit === "class" ? `${l.classes}コマ` : `${l.shiftCount}回`}
                          </td>
                          <td className="px-4 py-1.5 text-right font-mono">× ¥{l.rateAmountSnapshot.toLocaleString()}</td>
                          <td className="px-4 py-1.5 text-right font-mono font-medium">¥{l.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              ))}
            </div>
          </Card>
        )}

        <p className="text-center text-[10px] text-slate-400 py-4">
          このリンクは個人専用です。他者と共有しないでください。<br />
          リンクが有効期限切れの場合は、HR担当者へ新しいURLの発行を依頼してください。
        </p>
      </div>
    </div>
  );
}
