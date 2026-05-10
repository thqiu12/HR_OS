import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasRole } from "@/lib/permissions";
import { Card, CardHeader } from "@/components/ui";
import UsersClient from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!hasRole(session, "group_admin")) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
      </div>
    );
  }
  const users: any[] = db.allUsers();
  const enriched = users.map((u) => ({ ...u, roles: db.rolesByUserId(u.id) as any[] }));
  const schools = db.schools();
  const departments = db.departments();
  const entities = [...new Set((schools as any[]).map((s) => s.entity))];
  return <UsersClient users={enriched} schools={schools} departments={departments} entities={entities} myUserId={session.user.id} />;
}
