"use client";
import { Card, CardHeader } from "@/components/ui";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createJobAction } from "@/lib/master-actions";
import Link from "next/link";

export default function JobNewForm({ schools, departments }: { schools: any[]; departments: any[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState(schools[0]?.id || "");
  const deptOptions = useMemo(() => departments.filter((d) => d.schoolId === schoolId), [departments, schoolId]);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      try {
        await createJobAction({
          title: String(fd.get("title")),
          schoolId,
          departmentId: String(fd.get("departmentId")),
          route: String(fd.get("route")) as any,
          status: String(fd.get("status")) as any,
          openCount: Number(fd.get("openCount")) || 1,
        });
        router.push("/recruiting/pipeline");
        router.refresh();
      } catch (e: any) {
        setErr(e?.message || "作成に失敗しました");
      }
    });
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/recruiting/pipeline" className="text-sm text-brand-600 hover:underline">← 採用パイプラインへ戻る</Link>
      <Card>
        <CardHeader title="📋 求人を新規作成" subtitle="作成後すぐに候補者が応募できるようになります" />
        <form className="p-6 space-y-4" onSubmit={submit}>
          <Field label="求人タイトル *">
            <input name="title" required placeholder="常勤日本語講師（N1必須）" className={input} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="学校 *">
              <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className={input}>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="部門 *">
              <select name="departmentId" required className={input}>
                {deptOptions.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="採用ルート *">
              <select name="route" required className={input}>
                <option value="中途">中途</option>
                <option value="新卒">新卒</option>
              </select>
            </Field>
            <Field label="募集人数">
              <input name="openCount" type="number" min={1} defaultValue={1} className={input} />
            </Field>
            <Field label="ステータス">
              <select name="status" defaultValue="公開中" className={input}>
                <option value="下書き">下書き</option>
                <option value="公開中">公開中</option>
                <option value="停止">停止</option>
              </select>
            </Field>
          </div>
          {err && <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-lg">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <Link href="/recruiting/pipeline" className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</Link>
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {pending ? "作成中..." : "求人を作成"}
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
