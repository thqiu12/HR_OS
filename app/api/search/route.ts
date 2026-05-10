import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { filterEmployees, filterCandidates } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ results: [] });

  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (!q) return NextResponse.json({ results: [] });

  const empMatch = (e: any) =>
    e.name?.toLowerCase().includes(q) ||
    e.kana?.toLowerCase().includes(q) ||
    e.romaji?.toLowerCase().includes(q) ||
    e.empNo?.toLowerCase().includes(q) ||
    e.email?.toLowerCase().includes(q);

  const employees = filterEmployees(session, db.employees())
    .filter(empMatch)
    .slice(0, 5)
    .map((e: any) => ({
      kind: "社員",
      id: e.id,
      label: `${e.flag} ${e.name}`,
      sub: `${e.empNo} / ${e.position}`,
      href: `/organization/employees/${e.id}`,
    }));

  const candMatch = (c: any) =>
    c.name?.toLowerCase().includes(q) ||
    c.kana?.toLowerCase().includes(q) ||
    c.email?.toLowerCase().includes(q);

  const candidates = filterCandidates(session, db.candidates(), db.jobs())
    .filter(candMatch)
    .slice(0, 5)
    .map((c: any) => ({
      kind: "候補者",
      id: c.id,
      label: `${c.flag} ${c.name}`,
      sub: c.stage,
      href: `/recruiting/candidates/${c.id}`,
    }));

  return NextResponse.json({ results: [...employees, ...candidates] });
}
