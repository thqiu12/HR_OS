"use client";
import { Card, CardHeader, Badge } from "@/components/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Calculator, Lock, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { calculatePayrollAction, lockPayrollAction, exportPayrollCsvAction, exportPayrollMfCsvAction } from "@/lib/payroll-actions";

const STATUS_TONE: Record<string, any> = { open: "amber", locked: "blue", exported: "emerald" };
const STATUS_LABEL: Record<string, string> = { open: "計算中", locked: "確定", exported: "出力済" };

export default function PayrollClient({ yearMonth, period, lines }: { yearMonth: string; period: any; lines: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const navMonth = (delta: number) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    router.push(`/staffing/payroll/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const calc = () => {
    setErr(null); setInfo(null);
    start(async () => {
      try {
        const r = await calculatePayrollAction(yearMonth);
        setInfo(`✅ 計算完了 (${r.lines} 行)`);
        router.refresh();
      } catch (e: any) { setErr(e?.message); }
    });
  };

  const lock = () => {
    if (!confirm(`${yearMonth} を確定しますか? 確定後はシフト編集が制限されます。`)) return;
    setErr(null);
    start(async () => {
      try {
        const r = await lockPayrollAction(yearMonth);
        setInfo(`🔒 確定: ${r.totalEmployees} 名 / ¥${r.totalAmount.toLocaleString()}`);
        router.refresh();
      } catch (e: any) { setErr(e?.message); }
    });
  };

  const triggerDownload = (csv: string, fileName: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const exportCsv = (format: "freee" | "mf") => {
    setErr(null);
    start(async () => {
      try {
        const r = format === "mf" ? await exportPayrollMfCsvAction(yearMonth) : await exportPayrollCsvAction(yearMonth);
        triggerDownload(r.csv, r.fileName);
        setInfo(`📥 ${r.fileName} をダウンロード開始`);
        router.refresh();
      } catch (e: any) { setErr(e?.message); }
    });
  };

  // Aggregate by employee
  const byEmp = new Map<string, { name: string; empNo: string; type: string; total: number; rows: any[] }>();
  for (const l of lines) {
    const k = l.employeeId;
    if (!byEmp.has(k)) byEmp.set(k, { name: l.employeeName, empNo: l.employeeNo, type: l.employmentType, total: 0, rows: [] });
    const e = byEmp.get(k)!;
    e.total += l.amount;
    e.rows.push(l);
  }
  const totalAmount = lines.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="space-y-4 max-w-6xl">
      <Card>
        <CardHeader
          title={`💰 給与計算 ${yearMonth}`}
          subtitle={period
            ? `状態: ${STATUS_LABEL[period.status]} ／ ${byEmp.size} 名 ／ 合計 ¥${totalAmount.toLocaleString()}`
            : "未計算 — 「計算実行」を押してください"}
          right={
            <div className="flex items-center gap-2">
              <button onClick={() => navMonth(-1)} className="p-1.5 hover:bg-slate-100 rounded"><ChevronLeft size={16} /></button>
              <span className="text-sm font-mono">{yearMonth}</span>
              <button onClick={() => navMonth(1)} className="p-1.5 hover:bg-slate-100 rounded"><ChevronRight size={16} /></button>
              <Link href={`/staffing/shifts?ym=${yearMonth}`} className="ml-3 text-xs text-brand-600 hover:underline">← シフトへ戻る</Link>
            </div>
          }
        />
        <div className="p-4 flex items-center gap-2 border-b border-slate-100">
          <button onClick={calc} disabled={pending || period?.status !== "open" && !!period}
            className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-xs font-medium inline-flex items-center gap-1 disabled:opacity-60">
            <Calculator size={12} />{period ? "再計算" : "計算実行"}
          </button>
          <button onClick={lock} disabled={pending || !period || period.status !== "open" || lines.length === 0}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-medium inline-flex items-center gap-1 disabled:opacity-60">
            <Lock size={12} />確定
          </button>
          <button onClick={() => exportCsv("mf")} disabled={pending || lines.length === 0}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium inline-flex items-center gap-1 disabled:opacity-60"
            title="マネーフォワードクラウド給与「支給データ取込」用 (社員横並び形式)">
            <Download size={12} />CSV (MF給与)
          </button>
          <button onClick={() => exportCsv("freee")} disabled={pending || lines.length === 0}
            className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-md text-xs font-medium inline-flex items-center gap-1 disabled:opacity-60"
            title="明細形式 (一行あたり 1 賃率種別)">
            <Download size={12} />CSV (明細)
          </button>
          {period && <Badge tone={STATUS_TONE[period.status]} size="xs">{STATUS_LABEL[period.status]}</Badge>}
        </div>

        {err && <div className="m-4 bg-rose-50 text-rose-700 text-xs p-2 rounded">{err}</div>}
        {info && <div className="m-4 bg-emerald-50 text-emerald-700 text-xs p-2 rounded">{info}</div>}

        <div className="p-4 overflow-x-auto">
          {lines.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">
              シフト実績がありません。<br />
              <Link href={`/staffing/shifts?ym=${yearMonth}`} className="text-brand-600 hover:underline">シフト管理</Link> でシフトを「確定」状態にしてから計算してください。
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">社員番号</th>
                  <th className="text-left px-3 py-2">氏名</th>
                  <th className="text-left px-3 py-2">雇用形態</th>
                  <th className="text-left px-3 py-2">賃率種別</th>
                  <th className="text-right px-3 py-2">数量</th>
                  <th className="text-right px-3 py-2">単価</th>
                  <th className="text-right px-3 py-2">金額</th>
                  <th className="text-center px-3 py-2">回数</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...byEmp.values()].map((e) =>
                  e.rows.map((r, idx) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      {idx === 0 && (
                        <>
                          <td className="px-3 py-2 font-mono text-[10px] text-slate-500" rowSpan={e.rows.length}>{e.empNo}</td>
                          <td className="px-3 py-2 font-medium" rowSpan={e.rows.length}>{e.name}</td>
                          <td className="px-3 py-2 text-xs" rowSpan={e.rows.length}>
                            <Badge tone={e.type === "regular" ? "indigo" : e.type === "part_time" ? "amber" : "slate"} size="xs">{e.type}</Badge>
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2 text-xs">
                        {r.kind === "commute" ? "🚃 " : ""}{r.rateTypeName}
                        {r.kind === "commute" && (
                          <span className="ml-1 text-[10px] text-slate-400">{r.taxable ? "(課税)" : "(非課税)"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {r.kind === "commute"
                          ? (r.rateUnit === "commute_pass" ? "月額" : r.notes || "—")
                          : r.rateUnit === "hour" ? `${r.hours.toFixed(1)}h`
                          : r.rateUnit === "class" ? `${r.classes}コマ`
                          : `${r.shiftCount}回`}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">¥{r.rateAmountSnapshot.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">¥{r.amount.toLocaleString()}</td>
                      <td className="px-3 py-2 text-center text-xs text-slate-500">{r.kind === "commute" ? "—" : r.shiftCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-50 text-sm font-bold">
                <tr>
                  <td colSpan={6} className="px-3 py-2 text-right">合計</td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-700">¥{totalAmount.toLocaleString()}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
