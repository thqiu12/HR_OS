import { db } from "@/lib/db";
import { Card, CardHeader, Badge } from "@/components/ui";
import { notFound, redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { canViewEmployee, canCreateReviewFor } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import ProfileTimeline from "./timeline";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: { id: string }; searchParams: { newReview?: string; type?: string; fromReminder?: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  const e: any = db.employee(params.id);
  if (!e) return notFound();
  if (!canViewEmployee(session, e)) {
    await logAudit({ session, action: "performance.profile.view.denied", resourceType: "performance_profile", resourceId: e.id, reason: "scope" });
    return (
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
      </div>
    );
  }
  await logAudit({ session, action: "performance.profile.view", resourceType: "performance_profile", resourceId: e.id });
  const manager = e.managerId ? (db.employee(e.managerId) as any) : null;
  const evaluator = e.evaluatorId ? (db.employee(e.evaluatorId) as any) : null;
  const reviews: any[] = db.reviewsByEmployee(e.id);
  const reviewFilesByReviewId: Record<string, any[]> = {};
  for (const r of reviews) {
    reviewFilesByReviewId[r.id] = db.reviewFilesByReview(r.id) as any[];
  }
  const schools = db.schools();
  const departments = db.departments();
  const schoolName = schools.find((s: any) => s.id === e.schoolId)?.name || "";
  const deptName = departments.find((d: any) => d.id === e.departmentId)?.name || "";

  return (
    <div className="space-y-6 max-w-5xl">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-400 to-pink-400 text-white flex items-center justify-center text-xl">{e.flag}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">{e.name}</h2>
              <Badge tone="slate">{e.empNo}</Badge>
              <Badge tone={e.status === "在籍" ? "emerald" : "amber"}>{e.status}</Badge>
            </div>
            <div className="text-sm text-slate-500">{schoolName} / {deptName} / {e.position}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-4 gap-4 mt-5 text-sm">
          <Stat label="入社日" value={e.hireDate} />
          <Stat label="試用期間終了" value={e.probationEnd} />
          <Stat label="直属上司" value={manager?.name || "—"} />
          <Stat label="評価上司" value={evaluator?.name || manager?.name || "—"} />
        </div>
      </Card>

      <ProfileTimeline
        employee={{ id: e.id, name: e.name, probationEnd: e.probationEnd, hireDate: e.hireDate }}
        reviews={reviews}
        reviewFiles={reviewFilesByReviewId}
        canCreate={canCreateReviewFor(session, e)}
        defaultEvaluator={evaluator?.name || manager?.name || ""}
        autoOpen={searchParams.newReview === "1"}
        suggestType={searchParams.type as any}
        fromReminderId={searchParams.fromReminder}
      />

      {e.id === "e2" && (
        <Card>
          <CardHeader title="💰 給与改定履歴" right={<TrendingUp size={16} className="text-emerald-500" />} />
          <div className="p-5">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-500">2024-04</span>
              <span className="font-mono font-medium">¥250,000</span>
              <span className="text-slate-400">→</span>
              <span className="text-slate-500">2025-04</span>
              <span className="font-mono font-medium">¥262,500</span>
              <Badge tone="emerald" size="xs">+5%</Badge>
              <span className="text-slate-400">→</span>
              <span className="text-slate-500">2025-10</span>
              <span className="font-mono font-bold text-emerald-700">¥290,000</span>
              <Badge tone="emerald" size="xs">+10.5%（昇格）</Badge>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}
