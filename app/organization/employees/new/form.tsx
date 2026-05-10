"use client";
import { Card, CardHeader } from "@/components/ui";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createEmployeeAction } from "@/lib/master-actions";
import Link from "next/link";

const FLAGS: Record<string, string> = {
  "日本": "🇯🇵", "中国": "🇨🇳", "ベトナム": "🇻🇳", "ネパール": "🇳🇵", "韓国": "🇰🇷",
};

export default function EmployeeNewForm({ schools, departments }: { schools: any[]; departments: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState(schools[0]?.id || "");
  const [nationality, setNationality] = useState("日本");

  const deptOptions = useMemo(() => departments.filter((d) => d.schoolId === schoolId), [departments, schoolId]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        const res = await createEmployeeAction({
          empNo: String(fd.get("empNo")),
          name: String(fd.get("name")),
          kana: String(fd.get("kana")),
          romaji: String(fd.get("romaji")),
          nationality,
          flag: FLAGS[nationality] || "🏳",
          email: String(fd.get("email")),
          schoolId,
          departmentId: String(fd.get("departmentId")),
          position: String(fd.get("position")),
          hireRoute: String(fd.get("hireRoute")) as any,
          hireDate: String(fd.get("hireDate")),
          probationEnd: String(fd.get("probationEnd")),
          zairyuExpiry: nationality !== "日本" ? String(fd.get("zairyuExpiry") || "") || undefined : undefined,
        });
        router.push(`/organization/employees/${res.id}`);
        router.refresh();
      } catch (e: any) {
        setErr(e?.message || "作成に失敗しました");
      }
    });
  };

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/organization/tree" className="text-sm text-brand-600 hover:underline">← 組織ツリーへ戻る</Link>
      <Card>
        <CardHeader title="👤 社員を新規追加" subtitle="入社直後の試用期間として登録されます" />
        <form className="p-6 grid grid-cols-2 gap-4" onSubmit={submit}>
          <Field label="社員番号 *"><input name="empNo" required defaultValue="" placeholder="S0099" className={input} /></Field>
          <Field label="国籍 *">
            <select value={nationality} onChange={(e) => setNationality(e.target.value)} className={input}>
              {Object.keys(FLAGS).map((n) => <option key={n} value={n}>{FLAGS[n]} {n}</option>)}
            </select>
          </Field>
          <Field label="氏名（漢字） *"><input name="name" required placeholder="山田 太郎" className={input} /></Field>
          <Field label="ふりがな *"><input name="kana" required placeholder="ヤマダ タロウ" className={input} /></Field>
          <Field label="ローマ字 *"><input name="romaji" required placeholder="Yamada Taro" className={input} /></Field>
          <Field label="メール *"><input name="email" type="email" required placeholder="t.yamada@sakura.jp" className={input} /></Field>
          <Field label="所属学校 *">
            <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={input}>
              {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="所属部門 *">
            <select name="departmentId" required className={input}>
              {deptOptions.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="役職 *"><input name="position" required placeholder="常勤講師" className={input} /></Field>
          <Field label="採用ルート *">
            <select name="hireRoute" required className={input}>
              <option value="新卒">新卒</option>
              <option value="中途">中途</option>
            </select>
          </Field>
          <Field label="入社日 *"><input name="hireDate" type="date" required className={input} /></Field>
          <Field label="試用期間終了日 *"><input name="probationEnd" type="date" required className={input} /></Field>
          {nationality !== "日本" && (
            <Field label="在留カード期限"><input name="zairyuExpiry" type="date" className={input} /></Field>
          )}
          {err && <div className="col-span-2 bg-rose-50 text-rose-700 text-xs p-3 rounded-lg">{err}</div>}
          <div className="col-span-2 flex justify-end gap-2 pt-4">
            <Link href="/organization/tree" className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</Link>
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {pending ? "作成中..." : "社員を作成"}
            </button>
          </div>
        </form>
      </Card>
    </div>
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
