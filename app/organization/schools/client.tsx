"use client";
import { Card, CardHeader, Badge } from "@/components/ui";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit2, Save, X, AlertTriangle, Building2 } from "lucide-react";
import { createSchoolAction, updateSchoolAction, deleteSchoolAction } from "@/lib/master-actions";

const TYPES = [
  { value: "jls", label: "日本語学校" },
  { value: "senmon", label: "専門学校" },
  { value: "juku", label: "私塾" },
  { value: "university", label: "大学" },
  { value: "school", label: "学校（その他）" },
  { value: "hq", label: "本社" },
  { value: "other", label: "その他" },
];

export default function SchoolsClient({ schools }: { schools: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; type: string; entity: string }>({ name: "", type: "school", entity: "" });
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const startEdit = (s: any) => {
    setEditId(s.id);
    setEditForm({ name: s.name, type: s.type, entity: s.entity });
    setErr(null);
  };

  const saveEdit = (id: string) => {
    setErr(null);
    start(async () => {
      try { await updateSchoolAction(id, editForm); setEditId(null); setInfo("更新しました"); router.refresh(); }
      catch (e: any) { setErr(e?.message); }
    });
  };

  const onDelete = (s: any) => {
    if (!confirm(`「${s.name}」を削除しますか？\n所属社員 ${s.empCount}名 / 部門 ${s.deptCount}件 がある場合は削除できません。`)) return;
    setErr(null); setInfo(null);
    start(async () => {
      const r = await deleteSchoolAction(s.id);
      if (!r.ok) setErr(r.error);
      else { setInfo("削除しました"); router.refresh(); }
    });
  };

  // Group by entity
  const byEntity = new Map<string, any[]>();
  for (const s of schools) {
    if (!byEntity.has(s.entity)) byEntity.set(s.entity, []);
    byEntity.get(s.entity)!.push(s);
  }

  return (
    <div className="max-w-5xl space-y-4">
      <Card>
        <CardHeader
          title="🏫 学校 / 法人 マスタ"
          subtitle={`${schools.length} 校 ／ ${byEntity.size} 法人`}
          right={
            <button onClick={() => { setShowAdd(true); setErr(null); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-medium hover:bg-brand-700">
              <Plus size={14} />学校を追加
            </button>
          }
        />
        {(err || info) && (
          <div className={`px-5 py-2 text-xs ${err ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {err && <AlertTriangle size={12} className="inline mr-1" />}{err || info}
          </div>
        )}
        <div className="divide-y divide-slate-100">
          {[...byEntity.entries()].map(([entity, list]) => (
            <div key={entity} className="p-5">
              <div className="text-xs font-bold text-slate-500 mb-2 inline-flex items-center gap-1">
                <Building2 size={12} />{entity}（{list.length}校）
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  {list.map((s) => {
                    const isEditing = editId === s.id;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2 pr-4 w-10">
                          <span className="text-[10px] font-mono text-slate-400">{s.id}</span>
                        </td>
                        <td className="py-2 pr-4">
                          {isEditing ? (
                            <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                                   className="w-full px-2 py-1 border border-slate-200 rounded text-sm" autoFocus />
                          ) : (
                            <div className="font-medium">{s.name}</div>
                          )}
                        </td>
                        <td className="py-2 pr-4 w-32">
                          {isEditing ? (
                            <select value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}
                                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs">
                              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          ) : (
                            <Badge tone="indigo" size="xs">{TYPES.find((t) => t.value === s.type)?.label || s.type}</Badge>
                          )}
                        </td>
                        <td className="py-2 pr-4 w-48">
                          {isEditing ? (
                            <input value={editForm.entity} onChange={(e) => setEditForm((f) => ({ ...f, entity: e.target.value }))}
                                   className="w-full px-2 py-1 border border-slate-200 rounded text-xs" />
                          ) : (
                            <span className="text-xs text-slate-600">{s.entity}</span>
                          )}
                        </td>
                        <td className="py-2 pr-4 w-32 text-xs text-slate-500">
                          {!isEditing && <>社員 {s.empCount} / 部門 {s.deptCount}</>}
                        </td>
                        <td className="py-2 w-24 text-right">
                          {isEditing ? (
                            <div className="inline-flex gap-1">
                              <button onClick={() => saveEdit(s.id)} disabled={pending} className="text-emerald-600 hover:bg-emerald-50 rounded p-1.5"><Save size={13} /></button>
                              <button onClick={() => setEditId(null)} className="text-slate-400 hover:bg-slate-100 rounded p-1.5"><X size={13} /></button>
                            </div>
                          ) : (
                            <div className="inline-flex gap-1">
                              <button onClick={() => startEdit(s)} className="text-slate-500 hover:text-brand-600 p-1.5"><Edit2 size={13} /></button>
                              <button onClick={() => onDelete(s)} disabled={s.empCount > 0 || s.deptCount > 0}
                                      className="text-slate-500 hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed p-1.5"
                                      title={s.empCount > 0 || s.deptCount > 0 ? "所属員/部門があるため削除不可" : "削除"}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Card>

      {showAdd && <AddSchoolModal entities={[...byEntity.keys()]} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); router.refresh(); setInfo("学校を追加しました"); }} setErr={setErr} />}
    </div>
  );
}

function AddSchoolModal({ entities, onClose, onCreated, setErr }: { entities: string[]; onClose: () => void; onCreated: () => void; setErr: (s: string | null) => void }) {
  const [pending, start] = useTransition();
  const [useExisting, setUseExisting] = useState(true);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const entity = String(useExisting ? fd.get("entity") : fd.get("newEntity") || "");
    setErr(null);
    start(async () => {
      try {
        await createSchoolAction({
          name: String(fd.get("name")),
          type: String(fd.get("type")),
          entity,
        });
        onCreated();
      } catch (e: any) { setErr(e?.message); }
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold">🏫 学校を追加</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <form className="p-5 space-y-3" onSubmit={submit}>
          <div>
            <label className="block text-xs text-slate-500 mb-1">学校名 *</label>
            <input name="name" required placeholder="ABC日本語学校" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">学校種別 *</label>
            <select name="type" required defaultValue="jls" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">所属法人 *</label>
            <div className="flex items-center gap-2 mb-2 text-xs">
              <button type="button" onClick={() => setUseExisting(true)} className={`px-2 py-1 rounded ${useExisting ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}>既存から選択</button>
              <button type="button" onClick={() => setUseExisting(false)} className={`px-2 py-1 rounded ${!useExisting ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-slate-600"}`}>新規入力</button>
            </div>
            {useExisting ? (
              <select name="entity" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                {entities.map((e) => <option key={e}>{e}</option>)}
              </select>
            ) : (
              <input name="newEntity" required placeholder="学校法人〇〇" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {pending ? "作成中..." : "作成"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
