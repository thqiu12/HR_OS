"use client";
import { Card, CardHeader, Badge } from "@/components/ui";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Trash2, KeyRound, Edit2, Save, AlertTriangle } from "lucide-react";
import { createUserAction, updateUserRolesAction, deleteUserAction, resetUserPasswordAction } from "./actions";

const ROLES = [
  { value: "group_admin", label: "グループ管理者", scopeType: "group" as const, needsScope: false },
  { value: "entity_hr", label: "法人HR", scopeType: "entity" as const, needsScope: true },
  { value: "school_hr", label: "学校HR", scopeType: "school" as const, needsScope: true },
  { value: "principal", label: "校長", scopeType: "school" as const, needsScope: true },
  { value: "manager", label: "部門長", scopeType: "department" as const, needsScope: true },
  { value: "employee", label: "一般社員", scopeType: "school" as const, needsScope: true },
  { value: "executive", label: "経営層", scopeType: "group" as const, needsScope: false },
  { value: "auditor", label: "監査", scopeType: "group" as const, needsScope: false },
];

type RoleEntry = { role: string; scopeType: string; scopeId: string | null };

export default function UsersClient({
  users, schools, departments, entities, myUserId,
}: {
  users: any[]; schools: any[]; departments: any[]; entities: string[]; myUserId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingRoles, setEditingRoles] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onDelete = (u: any) => {
    if (!confirm(`${u.name} (${u.loginId}) を削除しますか？`)) return;
    setErr(null); setInfo(null);
    start(async () => {
      try { await deleteUserAction(u.id); setInfo(`${u.loginId} を削除しました`); router.refresh(); }
      catch (e: any) { setErr(e?.message); }
    });
  };

  const onReset = (u: any) => {
    setResetting(u.id);
  };
  const submitReset = (e: React.FormEvent<HTMLFormElement>, userId: string) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("password") || "");
    setErr(null); setInfo(null);
    start(async () => {
      try { await resetUserPasswordAction(userId, pw); setInfo("パスワードを更新しました"); setResetting(null); }
      catch (e: any) { setErr(e?.message); }
    });
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <Card>
        <CardHeader
          title="👥 ユーザー管理"
          subtitle={`${users.length} 件 / 追加・ロール変更・パスワードリセット・削除`}
          right={
            <button onClick={() => { setShowAdd(true); setErr(null); setInfo(null); }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-medium hover:bg-brand-700">
              <Plus size={14} />ユーザー追加
            </button>
          }
        />
        {(err || info) && (
          <div className={`px-5 py-2 text-xs ${err ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {err && <AlertTriangle size={12} className="inline mr-1" />}{err || info}
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-5 py-2 font-medium">ログインID</th>
              <th className="text-left px-5 py-2 font-medium">氏名 / メール</th>
              <th className="text-left px-5 py-2 font-medium">紐付け社員</th>
              <th className="text-left px-5 py-2 font-medium">ロール × スコープ</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 align-top">
                <td className="px-5 py-3 font-mono text-xs">{u.loginId}</td>
                <td className="px-5 py-3"><div className="font-medium">{u.name}</div><div className="text-xs text-slate-500">{u.email}</div></td>
                <td className="px-5 py-3 text-xs font-mono">{u.employeeId || <span className="text-slate-400">—</span>}</td>
                <td className="px-5 py-3">
                  {editingRoles === u.id ? (
                    <RolesEditor
                      userId={u.id}
                      initial={u.roles}
                      schools={schools}
                      departments={departments}
                      entities={entities}
                      onCancel={() => setEditingRoles(null)}
                      onSave={(roles) => {
                        setErr(null); setInfo(null);
                        start(async () => {
                          try { await updateUserRolesAction(u.id, roles); setInfo("ロールを更新しました"); setEditingRoles(null); router.refresh(); }
                          catch (e: any) { setErr(e?.message); }
                        });
                      }}
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r: any, i: number) => (
                        <Badge key={i} tone="indigo" size="xs">
                          {ROLES.find((x) => x.value === r.role)?.label || r.role}
                          {r.scopeId && <span className="ml-1 opacity-75">@{r.scopeId}</span>}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {resetting === u.id && (
                    <form onSubmit={(e) => submitReset(e, u.id)} className="mt-2 flex items-center gap-1">
                      <input name="password" type="password" required minLength={8} placeholder="新パスワード（8文字以上）" autoFocus
                             className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded" />
                      <button type="submit" disabled={pending} className="text-emerald-600 hover:bg-emerald-50 rounded p-1"><Save size={13} /></button>
                      <button type="button" onClick={() => setResetting(null)} className="text-slate-400 hover:bg-slate-100 rounded p-1"><X size={13} /></button>
                    </form>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {u.id !== myUserId && editingRoles !== u.id && (
                      <button onClick={() => { setEditingRoles(u.id); setErr(null); setInfo(null); }}
                              className="text-slate-500 hover:text-brand-600 p-1.5" title="ロール編集">
                        <Edit2 size={13} />
                      </button>
                    )}
                    <button onClick={() => onReset(u)} className="text-slate-500 hover:text-amber-600 p-1.5" title="パスワードリセット">
                      <KeyRound size={13} />
                    </button>
                    {u.id !== myUserId && (
                      <button onClick={() => onDelete(u)} disabled={pending} className="text-slate-500 hover:text-rose-600 p-1.5" title="削除">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showAdd && (
        <AddUserModal
          schools={schools}
          departments={departments}
          entities={entities}
          onClose={() => setShowAdd(false)}
          onCreated={() => { setShowAdd(false); router.refresh(); setInfo("ユーザーを作成しました"); }}
          setErr={setErr}
        />
      )}
    </div>
  );
}

function RolesEditor({ initial, schools, departments, entities, onSave, onCancel }: {
  userId: string; initial: RoleEntry[]; schools: any[]; departments: any[]; entities: string[];
  onSave: (roles: RoleEntry[]) => void; onCancel: () => void;
}) {
  const [roles, setRoles] = useState<RoleEntry[]>(initial.length > 0 ? initial : [{ role: "employee", scopeType: "school", scopeId: schools[0]?.id || null }]);

  const addRow = () => setRoles((p) => [...p, { role: "employee", scopeType: "school", scopeId: schools[0]?.id || null }]);
  const removeRow = (i: number) => setRoles((p) => p.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<RoleEntry>) => setRoles((p) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  return (
    <div className="space-y-1.5">
      {roles.map((r, i) => {
        const def = ROLES.find((x) => x.value === r.role);
        return (
          <div key={i} className="flex items-center gap-1">
            <select value={r.role} onChange={(e) => {
              const d = ROLES.find((x) => x.value === e.target.value)!;
              updateRow(i, { role: d.value, scopeType: d.scopeType, scopeId: d.needsScope ? (d.scopeType === "entity" ? entities[0] || null : d.scopeType === "department" ? departments[0]?.id || null : schools[0]?.id || null) : null });
            }} className="text-xs px-2 py-1 border border-slate-200 rounded">
              {ROLES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
            </select>
            {def?.needsScope && (
              <select value={r.scopeId || ""} onChange={(e) => updateRow(i, { scopeId: e.target.value || null })} className="text-xs px-2 py-1 border border-slate-200 rounded">
                {def.scopeType === "entity" && entities.map((e) => <option key={e} value={e}>{e}</option>)}
                {def.scopeType === "school" && schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                {def.scopeType === "department" && departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
            <button onClick={() => removeRow(i)} className="text-rose-600 hover:bg-rose-50 rounded p-1"><X size={11} /></button>
          </div>
        );
      })}
      <div className="flex items-center gap-2 pt-1">
        <button onClick={addRow} className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1"><Plus size={11} />ロール追加</button>
        <button onClick={() => onSave(roles)} className="ml-auto text-xs px-2 py-1 bg-emerald-600 text-white rounded">保存</button>
        <button onClick={onCancel} className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded">キャンセル</button>
      </div>
    </div>
  );
}

function AddUserModal({ schools, departments, entities, onClose, onCreated, setErr }: {
  schools: any[]; departments: any[]; entities: string[];
  onClose: () => void; onCreated: () => void; setErr: (s: string | null) => void;
}) {
  const [pending, start] = useTransition();
  const [roles, setRoles] = useState<RoleEntry[]>([{ role: "employee", scopeType: "school", scopeId: schools[0]?.id || null }]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => {
      try {
        await createUserAction({
          loginId: String(fd.get("loginId")),
          name: String(fd.get("name")),
          email: String(fd.get("email")),
          password: String(fd.get("password")),
          employeeId: String(fd.get("employeeId") || "") || undefined,
          roles,
        });
        onCreated();
      } catch (e: any) { setErr(e?.message); }
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold">👤 新規ユーザー</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <form className="p-5 space-y-3" onSubmit={submit}>
          <Field label="ログインID *"><input name="loginId" required pattern="[a-zA-Z0-9_-]+" placeholder="taro-yamada" className={input} /></Field>
          <Field label="氏名 *"><input name="name" required placeholder="山田 太郎" className={input} /></Field>
          <Field label="メール *"><input name="email" type="email" required placeholder="taro@sakura.jp" className={input} /></Field>
          <Field label="パスワード * (8文字以上)"><input name="password" type="password" required minLength={8} className={input} /></Field>
          <Field label="紐付け社員ID（任意）"><input name="employeeId" placeholder="e1 など" className={input} /></Field>
          <div>
            <label className="block text-xs text-slate-500 font-medium mb-2">ロール × スコープ *</label>
            <RolesEditor userId="new" initial={roles} schools={schools} departments={departments} entities={entities} onSave={setRoles} onCancel={() => {}} />
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

const input = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs text-slate-500 font-medium mb-1">{label}</label>{children}</div>;
}
