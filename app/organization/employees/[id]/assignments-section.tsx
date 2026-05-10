"use client";
import { Card, CardHeader, Badge } from "@/components/ui";
import { Plus, Trash2, X } from "lucide-react";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { addAssignmentAction, deleteAssignmentAction } from "@/lib/assignment-actions";

export default function AssignmentsSection({
  employeeId, canEdit, assignments, schools, departments,
}: {
  employeeId: string; canEdit: boolean;
  assignments: any[]; schools: any[]; departments: any[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const totalCost = assignments.reduce((s, a) => s + (a.costRatio || 0), 0);

  const onDelete = (id: string) => {
    if (!confirm("この兼任を削除しますか？")) return;
    setErr(null);
    start(async () => {
      try { await deleteAssignmentAction(employeeId, id); router.refresh(); }
      catch (e: any) { setErr(e?.message || "削除に失敗"); }
    });
  };

  return (
    <>
      <Card>
        <CardHeader
          title="🏢 所属情報（主所属 + 兼任）"
          subtitle={`合計コスト按分 ${totalCost}%`}
          right={canEdit && <button onClick={() => { setShowAdd(true); setErr(null); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-medium hover:bg-brand-700"><Plus size={14} />兼任を追加</button>}
        />
        {err && <div className="px-5 py-2 text-xs bg-rose-50 text-rose-700">{err}</div>}
        <div className="divide-y divide-slate-100">
          {assignments.length === 0 && (
            <div className="p-5 text-sm text-slate-400 text-center">所属情報がありません</div>
          )}
          {assignments.map((a) => (
            <div key={a.id} className="p-5">
              <div className="flex items-center gap-2 mb-2">
                {a.isPrimary === 1 ? <Badge tone="indigo">★ 主所属</Badge> : <Badge tone="violet">{a.assignmentType} ({a.costRatio}%)</Badge>}
                <span className="font-medium">{a.schoolName} / {a.deptName} / {a.position}</span>
                {!a.isPrimary && canEdit && (
                  <button onClick={() => onDelete(a.id)} className="ml-auto text-slate-400 hover:text-rose-600 p-1"><Trash2 size={13} /></button>
                )}
              </div>
              <div className="grid sm:grid-cols-3 gap-4 text-xs text-slate-600 pl-2">
                <div><span className="text-slate-400">開始日：</span>{a.startDate}</div>
                {a.endDate && <div><span className="text-slate-400">終了日：</span>{a.endDate}</div>}
                <div><span className="text-slate-400">コスト按分：</span>{a.costRatio}%</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="📊 コスト按分" subtitle={totalCost > 100 ? "⚠️ 100% を超えています" : `合計 ${totalCost}%`} />
        <div className="p-5">
          <div className="flex h-8 rounded-lg overflow-hidden">
            {assignments.map((a, i) => (
              <div
                key={a.id}
                style={{ width: `${a.costRatio}%` }}
                className={`text-white text-xs flex items-center justify-center ${
                  a.isPrimary === 1 ? "bg-brand-500" :
                  ["bg-violet-500", "bg-pink-500", "bg-amber-500"][i % 3]
                }`}
              >
                {a.isPrimary === 1 ? "主" : a.assignmentType[0]} {a.costRatio}%
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-slate-500">合計 {totalCost}%（100% を上限）</div>
        </div>
      </Card>

      {showAdd && (
        <AddAssignmentModal
          employeeId={employeeId}
          schools={schools}
          departments={departments}
          remainingCost={Math.max(0, 100 - totalCost)}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); router.refresh(); }}
          setErr={setErr}
        />
      )}
    </>
  );
}

function AddAssignmentModal({ employeeId, schools, departments, remainingCost, onClose, onCreated, setErr }: {
  employeeId: string; schools: any[]; departments: any[]; remainingCost: number;
  onClose: () => void; onCreated: () => void; setErr: (s: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const [schoolId, setSchoolId] = useState(schools[0]?.id || "");
  const deptOpts = useMemo(() => departments.filter((d) => d.schoolId === schoolId), [departments, schoolId]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => {
      try {
        await addAssignmentAction({
          employeeId,
          schoolId,
          departmentId: String(fd.get("departmentId")),
          position: String(fd.get("position")),
          assignmentType: String(fd.get("assignmentType")) as any,
          costRatio: Number(fd.get("costRatio")),
          startDate: String(fd.get("startDate")),
          endDate: String(fd.get("endDate") || "") || undefined,
        });
        onCreated();
      } catch (e: any) { setErr(e?.message); }
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold">➕ 兼任を追加</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <form className="p-5 space-y-3" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="種別 *">
              <select name="assignmentType" required defaultValue="兼任" className={input}>
                <option>兼任</option>
                <option>出向</option>
              </select>
            </Field>
            <Field label={`コスト按分 % * (残 ${remainingCost}%)`}>
              <input name="costRatio" type="number" required min={1} max={remainingCost} defaultValue={Math.min(40, remainingCost)} className={input} />
            </Field>
          </div>
          <Field label="所属学校 *">
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={input}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="部門 *">
            <select name="departmentId" required className={input}>
              {deptOpts.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="役職 *">
            <input name="position" required placeholder="非常勤講師" className={input} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="開始日 *"><input name="startDate" type="date" required defaultValue={new Date().toISOString().slice(0,10)} className={input} /></Field>
            <Field label="終了日"><input name="endDate" type="date" className={input} /></Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {pending ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const input = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-slate-500 font-medium mb-1">{label}</label>{children}</div>;
}
