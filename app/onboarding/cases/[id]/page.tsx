import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { filterOnboardingCases, canApproveOnboarding } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { issueInviteToken } from "@/lib/invite-token";
import OnboardingDetailClient from "./client";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  const c: any = db.onboardingCase(params.id);
  if (!c) return notFound();
  if (filterOnboardingCases(session, [c]).length === 0) {
    await logAudit({ session, action: "onboarding.case.view.denied", resourceType: "onboarding_case", resourceId: c.id, reason: "scope" });
    return (
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
      </div>
    );
  }
  await logAudit({ session, action: "onboarding.case.view", resourceType: "onboarding_case", resourceId: c.id });

  // Issue a fresh signed invite token (only HR roles get to see / share it)
  let inviteToken: string | null = null;
  if (canApproveOnboarding(session)) {
    inviteToken = await issueInviteToken({ caseId: c.id, issuedBy: session.user.id });
    await logAudit({ session, action: "invite.issued", resourceType: "onboarding_case", resourceId: c.id });
  }

  const schools = db.schools();
  const files: any[] = db.documentFilesByCase(c.id);
  return (
    <OnboardingDetailClient
      c={c}
      schoolName={schools.find((s: any) => s.id === c.schoolId)?.name || ""}
      canApprove={canApproveOnboarding(session)}
      inviteToken={inviteToken}
      files={files}
    />
  );
}
