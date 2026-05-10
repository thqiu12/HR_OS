"use client";
import { Button } from "@/components/ui";
import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateEmployeeAction } from "@/lib/master-actions";
import { EMPLOYMENT_TYPES, EMPLOYMENT_LABEL } from "@/lib/employment-types";

export default function EmployeeEditButton({ employee }: { employee: any }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>編集</Button>
      {open && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold">{employee.name} を編集</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <form
              className="p-5 grid grid-cols-2 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                setErr(null);
                const fd = new FormData(e.currentTarget as HTMLFormElement);
                const fields: Record<string, any> = {};
                for (const [k, v] of fd.entries()) {
                  if (v === "") {
                    // Allow clearing optional wage / contract fields by sending null
                    if (["hourlyRate", "perClassRate", "contractRenewalDate", "contractEnd", "zairyuExpiry"].includes(k)) {
                      fields[k] = null;
                    }
                    continue;
                  }
                  fields[k] = ["hourlyRate", "perClassRate", "costRatio"].includes(k) ? Number(v) : v;
                }
                start(async () => {
                  try {
                    await updateEmployeeAction(employee.id, fields);
                    setOpen(false);
                    router.refresh();
                  } catch (e: any) { setErr(e?.message || "更新に失敗しました"); }
                });
              }}
            >
              <Field label="氏名"><input name="name" defaultValue={employee.name} className={input} /></Field>
              <Field label="ふりがな"><input name="kana" defaultValue={employee.kana} className={input} /></Field>
              <Field label="メール"><input name="email" type="email" defaultValue={employee.email} className={input} /></Field>
              <Field label="役職"><input name="position" defaultValue={employee.position} className={input} /></Field>
              <Field label="ステータス">
                <select name="status" defaultValue={employee.status} className={input}>
                  <option value="在籍">在籍</option>
                  <option value="試用期間">試用期間</option>
                  <option value="休職">休職</option>
                  <option value="退職">退職</option>
                </select>
              </Field>
              <Field label="採用ルート">
                <select name="hireRoute" defaultValue={employee.hireRoute} className={input}>
                  <option value="新卒">新卒</option>
                  <option value="中途">中途</option>
                </select>
              </Field>
              <Field label="入社日"><input name="hireDate" type="date" defaultValue={employee.hireDate} className={input} /></Field>
              <Field label="試用期間終了"><input name="probationEnd" type="date" defaultValue={employee.probationEnd} className={input} /></Field>
              <Field label="契約終了日"><input name="contractEnd" type="date" defaultValue={employee.contractEnd ?? ""} className={input} /></Field>
              <Field label="在留カード期限"><input name="zairyuExpiry" type="date" defaultValue={employee.zairyuExpiry ?? ""} className={input} /></Field>
              <Field label="コスト按分 (%)"><input name="costRatio" type="number" min={0} max={100} defaultValue={employee.costRatio} className={input} /></Field>

              <div className="col-span-2 mt-2 pt-3 border-t border-slate-200">
                <div className="text-xs text-slate-500 font-bold mb-2">💼 雇用形態 / 賃金</div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="雇用形態">
                    <select name="employmentType" defaultValue={employee.employmentType || "regular"} className={input}>
                      {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{EMPLOYMENT_LABEL[t]}</option>)}
                    </select>
                  </Field>
                  <Field label="契約更新予定日">
                    <input name="contractRenewalDate" type="date" defaultValue={employee.contractRenewalDate ?? ""} className={input} />
                  </Field>
                  <Field label="時給 (円)">
                    <input name="hourlyRate" type="number" min={0} step={50} placeholder="3500" defaultValue={employee.hourlyRate ?? ""} className={input} />
                  </Field>
                  <Field label="コマ給 (円)">
                    <input name="perClassRate" type="number" min={0} step={100} placeholder="6000" defaultValue={employee.perClassRate ?? ""} className={input} />
                  </Field>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">時給は非常勤、コマ給は業務委託で使用。空欄にすると未設定になります。</p>
              </div>

              {err && <div className="col-span-2 bg-rose-50 text-rose-700 text-xs p-2 rounded-lg">{err}</div>}
              <div className="col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
                <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
                  {pending ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

const input = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 font-medium mb-1">{label}</label>
      {children}
    </div>
  );
}
