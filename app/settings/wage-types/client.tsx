"use client";
import { Badge, Button } from "@/components/ui";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";
import {
  createWageRateTypeAction, updateWageRateTypeAction, deleteWageRateTypeAction,
} from "@/lib/wage-actions";

const SCOPE_LABEL: Record<string, string> = { group: "全社", entity: "法人", school: "学校" };
const UNIT_LABEL: Record<string, string> = { hour: "時給", class: "コマ給", day: "日給", fixed: "固定" };
const UNIT_TONE: Record<string, any> = { hour: "indigo", class: "amber", day: "violet", fixed: "slate" };

export default function WageTypesClient({ types, schools, canDelete }: { types: any[]; schools: any[]; canDelete: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; defaultAmount: string; sortOrder: string; active: boolean }>({ name: "", defaultAmount: "", sortOrder: "0", active: true });
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const startEdit = (t: any) => {
    setEditId(t.id);
    setEditForm({
      name: t.name,
      defaultAmount: t.defaultAmount ? String(t.defaultAmount) : "",
      sortOrder: String(t.sortOrder ?? 0),
      active: !!t.active,
    });
    setErr(null);
  };

  const saveEdit = (id: number) => {
    setErr(null);
    start(async () => {
      try {
        await updateWageRateTypeAction(id, {
          name: editForm.name,
          defaultAmount: editForm.defaultAmount ? Number(editForm.defaultAmount) : null,
          sortOrder: Number(editForm.sortOrder) || 0,
          active: editForm.active,
        });
        setEditId(null);
        setInfo("更新しました");
        router.refresh();
      } catch (e: any) { setErr(e?.message); }
    });
  };

  const onDelete = (t: any) => {
    if (!confirm(`「${t.name}」を削除しますか?\n使用中の社員賃率がある場合は削除できません。`)) return;
    setErr(null);
    start(async () => {
      const r = await deleteWageRateTypeAction(t.id);
      if (!r.ok) setErr(r.error);
      else { setInfo("削除しました"); router.refresh(); }
    });
  };

  return (
    <div>
      <div className="flex justify-end px-5 pt-3 pb-2">
        <Button size="sm" onClick={() => { setShowAdd(true); setErr(null); }}>
          <Plus size={14} />賃率種別を追加
        </Button>
      </div>
      {(err || info) && (
        <div className={`mx-5 mb-2 px-3 py-2 text-xs rounded ${err ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {err || info}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-5 py-2 font-medium">スコープ</th>
              <th className="text-left px-5 py-2 font-medium">コード</th>
              <th className="text-left px-5 py-2 font-medium">表示名</th>
              <th className="text-left px-5 py-2 font-medium">単位</th>
              <th className="text-right px-5 py-2 font-medium">既定額 (円)</th>
              <th className="text-right px-5 py-2 font-medium">並び順</th>
              <th className="text-center px-5 py-2 font-medium">有効</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {types.map((t) => {
              const isEditing = editId === t.id;
              const scopeLabel = t.scopeType === "school"
                ? schools.find((s) => s.id === t.scopeId)?.name || t.scopeId
                : t.scopeType === "entity" ? t.scopeId : "全社";
              return (
                <tr key={t.id} className={`hover:bg-slate-50 ${t.active ? "" : "opacity-50"}`}>
                  <td className="px-5 py-2 text-xs"><Badge tone={t.scopeType === "group" ? "indigo" : t.scopeType === "entity" ? "violet" : "blue"} size="xs">{SCOPE_LABEL[t.scopeType]}</Badge> <span className="text-slate-500 ml-1">{scopeLabel}</span></td>
                  <td className="px-5 py-2"><code className="text-[10px] text-slate-500">{t.code}</code></td>
                  <td className="px-5 py-2 font-medium">
                    {isEditing ? (
                      <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="w-40 px-2 py-1 border border-slate-200 rounded text-sm" />
                    ) : t.name}
                  </td>
                  <td className="px-5 py-2"><Badge tone={UNIT_TONE[t.unit]} size="xs">{UNIT_LABEL[t.unit]}</Badge></td>
                  <td className="px-5 py-2 text-right font-mono">
                    {isEditing ? (
                      <input type="number" min={0} step={50} value={editForm.defaultAmount} onChange={(e) => setEditForm((f) => ({ ...f, defaultAmount: e.target.value }))} className="w-24 px-2 py-1 border border-slate-200 rounded text-xs text-right" />
                    ) : (t.defaultAmount ? `¥${Number(t.defaultAmount).toLocaleString()}` : "—")}
                  </td>
                  <td className="px-5 py-2 text-right text-xs text-slate-500">
                    {isEditing ? (
                      <input type="number" value={editForm.sortOrder} onChange={(e) => setEditForm((f) => ({ ...f, sortOrder: e.target.value }))} className="w-16 px-2 py-1 border border-slate-200 rounded text-xs text-right" />
                    ) : t.sortOrder}
                  </td>
                  <td className="px-5 py-2 text-center">
                    {isEditing ? (
                      <input type="checkbox" checked={editForm.active} onChange={(e) => setEditForm((f) => ({ ...f, active: e.target.checked }))} />
                    ) : (t.active ? "✓" : "—")}
                  </td>
                  <td className="px-5 py-2 text-right">
                    {isEditing ? (
                      <div className="inline-flex gap-1">
                        <button onClick={() => saveEdit(t.id)} disabled={pending} className="text-emerald-600 hover:bg-emerald-50 rounded p-1.5"><Save size={13} /></button>
                        <button onClick={() => setEditId(null)} className="text-slate-400 hover:bg-slate-100 rounded p-1.5"><X size={13} /></button>
                      </div>
                    ) : (
                      <div className="inline-flex gap-1">
                        <button onClick={() => startEdit(t)} className="text-slate-500 hover:text-brand-600 p-1.5"><Edit2 size={13} /></button>
                        {canDelete && <button onClick={() => onDelete(t)} className="text-slate-500 hover:text-rose-600 p-1.5"><Trash2 size={13} /></button>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddTypeModal schools={schools} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); router.refresh(); setInfo("追加しました"); }} setErr={setErr} />
      )}
    </div>
  );
}

function AddTypeModal({ schools, onClose, onCreated, setErr }: { schools: any[]; onClose: () => void; onCreated: () => void; setErr: (s: string | null) => void }) {
  const [pending, start] = useTransition();
  const [scopeType, setScopeType] = useState<"group" | "entity" | "school">("group");
  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold">💴 賃率種別を追加</h3>
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
                await createWageRateTypeAction({
                  scopeType: String(fd.get("scopeType")),
                  scopeId: String(fd.get("scopeId") || "") || null,
                  code: String(fd.get("code")),
                  name: String(fd.get("name")),
                  unit: String(fd.get("unit") || "hour"),
                  defaultAmount: fd.get("defaultAmount") ? Number(fd.get("defaultAmount")) : null,
                  sortOrder: Number(fd.get("sortOrder") || 0),
                });
                onCreated();
              } catch (e: any) { setErr(e?.message); }
            });
          }}
        >
          <div>
            <label className="block text-xs text-slate-500 mb-1">スコープ</label>
            <select name="scopeType" value={scopeType} onChange={(e) => setScopeType(e.target.value as any)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
              <option value="group">全社 (group)</option>
              <option value="entity">法人 (entity)</option>
              <option value="school">学校 (school)</option>
            </select>
          </div>
          {scopeType === "school" && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">学校</label>
              <select name="scopeId" required className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          {scopeType === "entity" && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">法人名</label>
              <input name="scopeId" required placeholder="学校法人〇〇" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">コード *</label>
              <input name="code" required pattern="[a-z][a-z0-9_]{1,30}" placeholder="custom_rate" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">単位</label>
              <select name="unit" defaultValue="hour" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option value="hour">時給 (hour)</option>
                <option value="class">コマ給 (class)</option>
                <option value="day">日給 (day)</option>
                <option value="fixed">固定 (fixed)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">表示名 *</label>
            <input name="name" required placeholder="例: 担任手当時給" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">既定額 (円)</label>
              <input name="defaultAmount" type="number" min={0} step={50} placeholder="例: 3000" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">並び順</label>
              <input name="sortOrder" type="number" defaultValue={100} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>
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
