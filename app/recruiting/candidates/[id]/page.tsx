import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { filterCandidates } from "@/lib/permissions";
import CandidateClient from "./client";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) redirect("/login");
  const c: any = db.candidate(params.id);
  if (!c) return notFound();
  const allowed = filterCandidates(session, [c], db.jobs());
  if (allowed.length === 0) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
        <div className="text-4xl">🚫</div>
        <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
      </div>
    );
  }
  const job: any = c.jobId ? db.job(c.jobId) : null;
  const schools = db.schools();
  const departments = db.departments();
  const resumeFile: any = db.candidateLatestResume(c.id);
  const allFiles: any[] = db.candidateFiles(c.id);
  const interviews: any[] = db.interviewsByCandidate(c.id);

  let parsed: any = null;
  if (c.aiParsedData) {
    try { parsed = JSON.parse(c.aiParsedData); } catch { parsed = null; }
  }

  return (
    <CandidateClient
      c={c}
      job={job}
      schoolName={schools.find((s: any) => s.id === job?.schoolId)?.name || ""}
      deptName={departments.find((d: any) => d.id === job?.departmentId)?.name || ""}
      resumeFile={resumeFile}
      files={allFiles}
      interviews={interviews}
      parsed={parsed}
      parseStatus={c.aiParseStatus}
      parseModel={c.aiParseModel}
      hasApiKey={!!process.env.ANTHROPIC_API_KEY}
    />
  );
}
