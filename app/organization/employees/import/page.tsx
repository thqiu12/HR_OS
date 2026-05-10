import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { canEditMaster, hasRole } from "@/lib/permissions";
import ImportClient from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canEditMaster(session) && !hasRole(session, "school_hr")) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
      </div>
    );
  }
  return <ImportClient />;
}
