import { db } from "@/lib/db";
import RemindersClient from "./client";
import { auth } from "@/auth";
import { filterReminders, canSeeModule } from "@/lib/permissions";
import { Forbidden } from "@/components/ui";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canSeeModule(session, "reminders")) return <Forbidden />;
  const reminders = filterReminders(session, db.reminders());
  const schools = db.schools();
  const enriched = reminders.map((r: any) => ({
    ...r,
    schoolName: schools.find((s: any) => s.id === r.schoolId)?.name || "",
  }));
  return <RemindersClient reminders={enriched} />;
}
