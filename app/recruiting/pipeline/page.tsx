import { db } from "@/lib/db";
import { auth } from "@/auth";
import { filterJobs, filterCandidates, filterSchools, canMoveCandidateStage, canSeeModule } from "@/lib/permissions";
import { Forbidden } from "@/components/ui";
import { redirect } from "next/navigation";
import PipelineClient from "./client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await auth();
  if (!session) redirect("/login");
  if (!canSeeModule(session, "recruiting")) return <Forbidden />;

  const jobs = filterJobs(session, db.jobs());
  const candidates = filterCandidates(session, db.candidates(), db.jobs());
  const schools = filterSchools(session, db.schools());
  return <PipelineClient candidates={candidates} jobs={jobs} schools={schools} canMove={canMoveCandidateStage(session)} />;
}
