"use client";
import { Card, CardHeader, Badge } from "@/components/ui";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2 } from "lucide-react";
import { createShiftPatternAction, endShiftPatternAction } from "@/lib/shift-actions";

const DOW_LABEL = ["日", "月", "火", "水", "木", "金", "土"];

export default function PatternsClient({
  schools, currentSchoolId, employees, patterns, rateTypes,
}: {
  schools: any[]; currentSchoolId: string; employees: any[]; patterns: any[]; rateTypes: any[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onEnd = (p: any) => {
    const at = prompt(`「${p.employeeName} 毎週${DOW_LABEL[p.dayOfWeek]}曜 ${p.startTime}-${p.endTime}」を終了する日付`,
      new Date().toISOString().slice(0, 10));
    if (!at) return;
    start(async () => {
      try { await endShiftPatternAction(p.id, at); router.refresh(); }
      catch (e: any) { setErr(e?.message); }
    });
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <Card>
        <CardHeader
          title="🔁 週次シフトパターン"
          subtitle="毎週同じ曜日・時間のシフトをテンプレ化。月次の自動生成元になります。"
          right={
            <div className="flex items-center gap-2">
              <select value={currentSchoolId} onChange={(e) => router.push(`/staffing/shifts/patterns?school=${e.target.value}`)} className="px-3 py-1.5 border border-slate-200 rounded-md text-xs">
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-xs font-medium inline-flex items-center gap-1">
                <Plus size={12} />パターン追加
              </button>
            </div>
          }
        />
        <div className="p-4">
          {err && <div className="bg-rose-50 text-rose-700 text-xs p-2 rounded mb-3">{err}</div>}
          {patterns.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">パターンが登録されていません。「パターン追加」から作成してください。</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2">社員</th>
                  <th className="text-center px-3 py-2">曜日</th>
                  <th className="text-left px-3 py-2">時間</th>
                  <th className="text-left px-3 py-2">賃率種別</th>
                  <th className="text-left px-3 py-2">適用開始</th>
                  <th className="text-left px-3 py-2">備考</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patterns.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{p.employeeName}</td>
                    <td className="px-3 py-2 text-center"><Badge tone="indigo" size="xs">{DOW_LABEL[p.dayOfWeek]}</Badge></td>
                    <td className="px-3 py-2 font-mono text-xs">{p.startTime}〜{p.endTime}</td>
                    <td className="px-3 py-2 text-xs">{p.rateTypeName}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{p.effectiveFrom}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{p.notes || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => onEnd(p)} disabled={pending} className="text-xs text-rose-600 hover:underline">終了</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {showAdd && (
        <AddPatternModal
          schoolId={currentSchoolId}
          employees={employees}
          rateTypes={rateTypes}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); router.refresh(); }}
        />
      )}
    </div>
  );
}

function AddPatternModal({ schoolId, employees, rateTypes, onClose, onAdded }: any) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold">🔁 週次パターンを追加</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <form
          className="p-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setErr(null);
            start(async () => {
              try {
                await createShiftPatternAction({
                  employeeId: String(fd.get("employeeId")),
                  schoolId,
                  rateTypeId: Number(fd.get("rateTypeId")),
                  dayOfWeek: Number(fd.get("dayOfWeek")),
                  startTime: String(fd.get("startTime")),
                  endTime: String(fd.get("endTime")),
                  effectiveFrom: String(fd.get("effectiveFrom")),
                  notes: String(fd.get("notes") || ""),
                });
                onAdded();
              } catch (e: any) { setErr(e?.message); }
            });
          }}
        >
          <div>
            <label className="block text-xs text-slate-500 mb-1">社員</label>
            <select name="employeeId" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
              {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name} ({e.empNo}) {e.employmentType !== "regular" ? `[${e.employmentType}]` : ""}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">曜日</label>
              <select name="dayOfWeek" required defaultValue="1" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                {DOW_LABEL.map((d, i) => <option key={i} value={i}>{d}曜</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">開始</label>
              <input name="startTime" type="time" required defaultValue="09:00" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">終了</label>
              <input name="endTime" type="time" required defaultValue="17:00" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">賃率種別</label>
            <select name="rateTypeId" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
              {rateTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name} ({t.unit === "hour" ? "時給" : t.unit === "class" ? "コマ給" : t.unit})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">適用開始日</label>
            <input name="effectiveFrom" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">備考 (任意)</label>
            <input name="notes" placeholder="例: N1 文法担当" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          {err && <div className="bg-rose-50 text-rose-700 text-xs p-2 rounded">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm disabled:opacity-60">
              {pending ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
