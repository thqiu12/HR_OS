import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasRole, canEditMaster } from "@/lib/permissions";
import { Card, CardHeader, Forbidden } from "@/components/ui";
import WageTypesClient from "./client";

export const dynamic = "force-dynamic";

export default async function WageTypesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasRole(session, "group_admin") && !canEditMaster(session)) {
    return <Forbidden message="賃率マスタは HR管理者のみ編集できます" />;
  }
  const types: any[] = db.allWageRateTypes() as any[];
  const schools: any[] = db.schools() as any[];
  return (
    <div className="max-w-5xl space-y-4">
      <Card>
        <CardHeader
          title="💴 賃率マスタ"
          subtitle="授業時給 / 事務時給 / 会議時給 など、賃率の種別を自由に追加・編集できます"
        />
        <WageTypesClient types={types} schools={schools} canDelete={hasRole(session, "group_admin")} />
      </Card>
    </div>
  );
}
