import { verifyInviteToken, touchInvite } from "@/lib/invite-token";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import InvitePortal from "./client";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { token: string } }) {
  const result = await verifyInviteToken(params.token);

  if (result.ok === false) {
    await logAudit({ action: "invite.verify.failed", reason: result.reason });
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex items-center justify-center p-6">
        <div className="max-w-md bg-white rounded-2xl shadow-card p-8 text-center">
          <div className="text-5xl">⚠️</div>
          <h1 className="mt-4 font-bold text-lg">この招待リンクは無効です</h1>
          <p className="text-sm text-slate-500 mt-2">{messageFor(result.reason)}</p>
          <p className="text-xs text-slate-400 mt-4">人事部にお問い合わせの上、新しい招待リンクをお受け取りください。</p>
        </div>
      </div>
    );
  }

  const c: any = db.onboardingCase(result.caseId);
  if (!c) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-sm text-slate-500">案件情報が見つかりません。</div>
      </div>
    );
  }

  touchInvite(result.jti);
  await logAudit({
    action: "invite.used",
    resourceType: "onboarding_case",
    resourceId: c.id,
    user: { loginId: `invite:${result.jti.slice(0, 8)}` },
  });

  const schools = db.schools();
  return (
    <InvitePortal
      token={params.token}
      jti={result.jti}
      expiresAt={result.expiresAt}
      caseData={{
        id: c.id,
        candidateName: c.candidateName,
        flag: c.flag,
        schoolName: schools.find((s: any) => s.id === c.schoolId)?.name || "",
        position: c.position,
        route: c.route,
        expectedJoinDate: c.expectedJoinDate,
        docs: c.docs,
      }}
    />
  );
}

function messageFor(reason: string): string {
  switch (reason) {
    case "expired": return "招待リンクの有効期限（発行から30日）が切れています。";
    case "revoked": return "この招待リンクは取り消されました。";
    case "unknown_jti": return "このリンクは登録されていません。";
    case "rate_limited": return "短時間に多数のアクセスがありました。1分後に再度お試しください。";
    case "wrong_audience":
    case "wrong_issuer":
    case "invalid_signature":
    default:
      return "リンクの署名が正しくありません。";
  }
}
