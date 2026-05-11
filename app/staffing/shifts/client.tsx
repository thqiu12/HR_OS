"use client";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Plus, Calendar, Layers } from "lucide-react";
import { generateMonthFromPatternsAction, cancelShiftAssignmentAction, deleteShiftAssignmentAction } from "@/lib/shift-actions";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];
const STATUS_TONE: Record<string, any> = {
  planned: "slate", confirmed: "blue", completed: "emerald",
  cancelled: "rose", substituted: "amber", paid: "violet",
};
const STATUS_LABEL: Record<string, string> = {
  planned: "予定", confirmed: "確定", completed: "実施済",
  cancelled: "中止", substituted: "代講", paid: "支払済",
};

function buildMonthGrid(yearMonth: string): { date: string; day: number; dow: number; }[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const out: { date: string; day: number; dow: number }[] = [];
  for (let d = 1; d <= days; d++) {
    const date = `${yearMonth}-${String(d).padStart(2, "0")}`;
    out.push({ date, day: d, dow: new Date(date).getDay() });
  }
  return out;
}

export default function ShiftsClient({
  yearMonth, schools, currentSchoolId, employees, currentEmpId, shifts,
}: {
  yearMonth: string;
  schools: any[];
  currentSchoolId: string;
  employees: any[];
  currentEmpId: string;
  shifts: any[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const days = buildMonthGrid(yearMonth);
  const shiftsByDate = new Map<string, any[]>();
  for (const s of shifts) {
    if (!shiftsByDate.has(s.date)) shiftsByDate.set(s.date, []);
    shiftsByDate.get(s.date)!.push(s);
  }

  const navMonth = (delta: number) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const newYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const sp = new URLSearchParams(params.toString());
    sp.set("ym", newYm);
    router.push(`/staffing/shifts?${sp.toString()}`);
  };

  const setSchool = (id: string) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("school", id);
    sp.delete("emp");
    router.push(`/staffing/shifts?${sp.toString()}`);
  };
  const setEmp = (id: string) => {
    const sp = new URLSearchParams(params.toString());
    if (id) sp.set("emp", id); else sp.delete("emp");
    router.push(`/staffing/shifts?${sp.toString()}`);
  };

  const generate = () => {
    if (!currentSchoolId) { setErr("学校を選択してください"); return; }
    if (!confirm(`${yearMonth} の週次パターンから自動生成しますか?`)) return;
    setErr(null); setInfo(null);
    start(async () => {
      try {
        const r = await generateMonthFromPatternsAction({
          yearMonth,
          schoolId: currentSchoolId,
          ...(currentEmpId ? { employeeId: currentEmpId } : {}),
        });
        setInfo(`${r.generated} 件のシフトを生成しました`);
        router.refresh();
      } catch (e: any) { setErr(e?.message || "生成失敗"); }
    });
  };

  const onCancel = (s: any) => {
    const reason = prompt(`${s.date} ${s.startTime} ${s.employeeName} のシフトを中止する理由`);
    if (!reason) return;
    start(async () => {
      try {
        await cancelShiftAssignmentAction(s.id, reason);
        router.refresh();
      } catch (e: any) { setErr(e?.message); }
    });
  };

  const onDelete = (s: any) => {
    if (!confirm(`${s.date} ${s.startTime} ${s.employeeName} のシフトを削除?`)) return;
    start(async () => {
      try {
        await deleteShiftAssignmentAction(s.id);
        router.refresh();
      } catch (e: any) { setErr(e?.message); }
    });
  };

  // Stats
  const totalHours = shifts.reduce((s, x) => s + (x.hours || 0), 0);
  const totalAmount = shifts.reduce((s, x) => {
    if (x.status === "cancelled") return s;
    if (x.rateUnit === "hour") return s + x.hours * x.rateAmountSnapshot;
    if (x.rateUnit === "class") return s + x.classes * x.rateAmountSnapshot;
    return s + x.rateAmountSnapshot;
  }, 0);

  return (
    <div className="space-y-4 max-w-7xl">
      <Card>
        <CardHeader
          title={`📅 シフト ${yearMonth}`}
          subtitle={`${shifts.length} 件 ／ 合計 ${totalHours.toFixed(1)}h ／ 概算 ¥${Math.floor(totalAmount).toLocaleString()}`}
          right={
            <div className="flex items-center gap-2">
              <button onClick={() => navMonth(-1)} className="p-1.5 hover:bg-slate-100 rounded"><ChevronLeft size={16} /></button>
              <span className="text-sm font-mono">{yearMonth}</span>
              <button onClick={() => navMonth(1)} className="p-1.5 hover:bg-slate-100 rounded"><ChevronRight size={16} /></button>
              <Link href={`/staffing/shifts/patterns?school=${currentSchoolId}`} className="ml-3 text-xs text-brand-600 hover:underline inline-flex items-center gap-1"><Layers size={12} />週次パターン</Link>
              <Link href={`/staffing/payroll/${yearMonth}`} className="text-xs text-brand-600 hover:underline">給与計算 →</Link>
            </div>
          }
        />
        <div className="p-4 flex flex-wrap items-center gap-2 border-b border-slate-100">
          <select value={currentSchoolId} onChange={(e) => setSchool(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-md text-xs">
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={currentEmpId} onChange={(e) => setEmp(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-md text-xs">
            <option value="">— 全社員 ({employees.length}) —</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.empNo})</option>)}
          </select>
          <button onClick={generate} disabled={pending}
            className="ml-auto px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-xs font-medium inline-flex items-center gap-1 disabled:opacity-60">
            <Plus size={12} />週次パターンから生成
          </button>
        </div>

        {err && <div className="mx-4 mt-3 bg-rose-50 text-rose-700 text-xs p-2 rounded">{err}</div>}
        {info && <div className="mx-4 mt-3 bg-emerald-50 text-emerald-700 text-xs p-2 rounded">{info}</div>}

        <div className="p-4">
          <div className="grid grid-cols-7 gap-px bg-slate-200">
            {DOW.map((d, i) => (
              <div key={d} className={`p-2 text-center text-xs font-medium bg-slate-50 ${i === 0 ? "text-rose-600" : i === 6 ? "text-blue-600" : "text-slate-700"}`}>
                {d}
              </div>
            ))}
            {/* Padding for first week */}
            {Array.from({ length: days[0]?.dow || 0 }).map((_, i) => (
              <div key={`pad-${i}`} className="bg-slate-50 min-h-24" />
            ))}
            {days.map((d) => {
              const cellShifts = shiftsByDate.get(d.date) || [];
              const dayTotal = cellShifts.filter((s) => s.status !== "cancelled").reduce((sum, s) => {
                if (s.rateUnit === "hour") return sum + s.hours * s.rateAmountSnapshot;
                if (s.rateUnit === "class") return sum + s.classes * s.rateAmountSnapshot;
                return sum + s.rateAmountSnapshot;
              }, 0);
              return (
                <div key={d.date} className="bg-white min-h-24 p-1.5 text-xs">
                  <div className={`flex items-center justify-between mb-1 ${d.dow === 0 ? "text-rose-600" : d.dow === 6 ? "text-blue-600" : "text-slate-700"}`}>
                    <span className="font-medium">{d.day}</span>
                    {dayTotal > 0 && <span className="text-[9px] text-slate-400 font-mono">¥{Math.floor(dayTotal).toLocaleString()}</span>}
                  </div>
                  <div className="space-y-1">
                    {cellShifts.slice(0, 4).map((s) => (
                      <div key={s.id} className={`group rounded px-1.5 py-0.5 text-[10px] cursor-pointer hover:ring-1 hover:ring-brand-300
                        ${s.status === "cancelled" ? "bg-rose-50 text-rose-600 line-through" :
                         s.status === "completed" || s.status === "paid" ? "bg-emerald-50 text-emerald-700" :
                         s.status === "confirmed" ? "bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-700"}
                      `}
                        title={`${s.employeeName} ${s.startTime}-${s.endTime} ${s.rateTypeName} ¥${s.rateAmountSnapshot}/${s.rateUnit === "hour" ? "h" : "コマ"}`}
                      >
                        <div className="flex items-center gap-1 truncate">
                          <span>{s.startTime.slice(0,5)}</span>
                          <span className="truncate flex-1">{s.employeeName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] opacity-60">{s.rateTypeName}</span>
                          <span className="opacity-0 group-hover:opacity-100 flex gap-1">
                            {s.status !== "cancelled" && (
                              <button onClick={() => onCancel(s)} className="text-amber-500 hover:text-amber-700">中</button>
                            )}
                            <button onClick={() => onDelete(s)} className="text-rose-500 hover:text-rose-700">×</button>
                          </span>
                        </div>
                      </div>
                    ))}
                    {cellShifts.length > 4 && (
                      <div className="text-[9px] text-slate-400 text-center">他 {cellShifts.length - 4}件</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
