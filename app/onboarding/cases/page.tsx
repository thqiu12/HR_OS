import { db } from "@/lib/db";
import { Card, CardHeader, Badge, Progress, Button, Forbidden } from "@/components/ui";
import Link from "next/link";
import { ChevronRight, Send } from "lucide-react";
import { auth } from "@/auth";
import { filterOnboardingCases, canApproveOnboarding, canSeeModule } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canSeeModule(session, "onboarding")) return <Forbidden />;
  const cases: any[] = filterOnboardingCases(session, db.onboardingCases());
  const schools: any[] = db.schools();
  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name || "";
  const canInvite = canApproveOnboarding(session);

  return (
    <Card>
      <CardHeader
        title="入社手続き 案件一覧"
        subtitle="内定者ごとの書類提出状況とHR確認状況"
        right={canInvite && <Button size="sm"><Send size={14} />内定者ポータル招待リンクを発行</Button>}
      />
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs">
          <tr>
            <th className="text-left px-5 py-2 font-medium">氏名</th>
            <th className="text-left px-5 py-2 font-medium">学校 / 役職</th>
            <th className="text-left px-5 py-2 font-medium">ルート</th>
            <th className="text-left px-5 py-2 font-medium">入社予定日</th>
            <th className="text-left px-5 py-2 font-medium w-72">進捗</th>
            <th className="text-left px-5 py-2 font-medium">未完了書類</th>
            <th className="text-left px-5 py-2 font-medium">ステータス</th>
            <th className="px-5 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cases.length === 0 && (
            <tr><td colSpan={8} className="text-center text-sm text-slate-400 py-8">アクセス可能な案件がありません</td></tr>
          )}
          {cases.map((c) => {
            const remaining = c.docs.filter((d: any) => d.status !== "完了").length;
            return (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium">{c.flag} {c.candidateName}</td>
                <td className="px-5 py-3 text-slate-600">
                  <div>{schoolName(c.schoolId)}</div>
                  <div className="text-xs text-slate-400">{c.position}</div>
                </td>
                <td className="px-5 py-3"><Badge tone={c.route === "新卒" ? "blue" : "violet"}>{c.route}</Badge></td>
                <td className="px-5 py-3">{c.expectedJoinDate}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <Progress value={c.progress} />
                    <span className="text-xs text-slate-500 w-10 text-right">{c.progress}%</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  {remaining > 0 ? <Badge tone="amber">{remaining}件</Badge> : <Badge tone="emerald">0件</Badge>}
                </td>
                <td className="px-5 py-3">
                  <Badge tone={c.status === "完了" ? "emerald" : c.status === "HR確認中" ? "amber" : "slate"}>{c.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <Link href={`/onboarding/cases/${c.id}`} className="text-brand-600 inline-flex items-center text-xs hover:underline">
                    詳細<ChevronRight size={14} />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
