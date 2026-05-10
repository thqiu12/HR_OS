import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Card, CardHeader, Forbidden } from "@/components/ui";
import TwoFactorClient from "./client";

export const dynamic = "force-dynamic";

export default async function TwoFactorPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const u = db.userById(session.user.id);
  if (!u) return <Forbidden message="ユーザーが見つかりません" />;

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader title="🔐 二要素認証 (2FA)" subtitle="Authenticator アプリでログインを保護します" />
        <TwoFactorClient enabled={!!u.totpSecret} enabledAt={u.totpEnabledAt || null} />
      </Card>
    </div>
  );
}
