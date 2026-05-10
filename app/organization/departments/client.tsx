"use client";
import { Card, CardHeader, Badge } from "@/components/ui";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDepartmentAction, renameDepartmentAction, deleteDepartmentAction } from "@/lib/master-actions";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import Link from "next/link";

export default function DepartmentsClient({ schools, departments }: { schools: any[]; departments: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newSchool, setNewSchool] = useState(schools[0]?.id || "");
  const [newName, setNewName] = useState("");

  const refresh = () => router.refresh();

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null); setInfo(null);
    if (!newName.trim()) return;
    start(async () => {
      try { await createDepartmentAction({ schoolId: newSchool, name: newName }); setNewName(""); setInfo("部門を作成しました"); refresh(); }
      catch (e: any) { setErr(e?.message); }
    });
  };

  const onRename = (id: string) => {
    if (!editName.trim()) return;
    start(async () => {
      try { await renameDepartmentAction(id, editName); setEditingId(null); refresh(); }
      catch (e: any) { setErr(e?.message); }
    });
  };

  const onDelete = (id: string) => {
    if (!confirm("この部門を削除しますか？所属員がいる場合は削除できません。")) return;
    start(async () => {
      const r = await deleteDepartmentAction(id);
      if (!r.ok) setErr(r.error);
      else { setInfo("削除しました"); refresh(); }
    });
  };

  const groupedBySchool = schools.map((s) => ({
    school: s,
    depts: departments.filter((d) => d.schoolId === s.id),
  }));

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/organization/tree" className="text-sm text-brand-600 hover:underline">← 組織ツリーへ戻る</Link>

      <Card>
        <CardHeader title="🏢 部門マスタ" subtitle="学校ごとの部門を作成・編集・削除" />
        <form className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-end gap-2 flex-wrap" onSubmit={onCreate}>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs text-slate-500 mb-1">学校</label>
            <select value={newSchool} onChange={(e) => setNewSchool(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-slate-500 mb-1">新しい部門名</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例：国際交流部" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white" />
          </div>
          <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-60 inline-flex items-center gap-1">
            <Plus size={14} />追加
          </button>
        </form>

        {(err || info) && (
          <div className={`px-5 py-2 text-xs ${err ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {err || info}
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {groupedBySchool.map(({ school, depts }) => (
            <div key={school.id} className="p-5">
              <div className="text-xs font-bold text-slate-500 mb-2">{school.name}</div>
              <div className="space-y-1">
                {depts.length === 0 && <div className="text-xs text-slate-400">部門がありません</div>}
                {depts.map((d: any) => (
                  <div key={d.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
                    {editingId === d.id ? (
                      <>
                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded" autoFocus />
                        <button onClick={() => onRename(d.id)} className="text-emerald-600 hover:bg-emerald-50 rounded p-1"><Check size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400 hover:bg-slate-100 rounded p-1"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-medium">{d.name}</span>
                        <Badge tone="slate" size="xs">{d.employeeCount}名</Badge>
                        <button onClick={() => { setEditingId(d.id); setEditName(d.name); }} className="text-slate-400 hover:text-brand-600 p-1"><Edit2 size={13} /></button>
                        <button onClick={() => onDelete(d.id)} disabled={d.employeeCount > 0} className="text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed p-1" title={d.employeeCount > 0 ? "所属員がいるため削除できません" : "削除"}><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
