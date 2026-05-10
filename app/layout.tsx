import "@/lib/env-check"; // Fail-fast env validation (production only)
import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { filterSchools, accessibleSchoolIds } from "@/lib/permissions";

const noto = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-noto", weight: ["400", "500", "700"] });

export const metadata: Metadata = {
  title: "HR OS — グループ統合人事システム",
  description: "学校法人・株式会社向けグループ統合HRシステム",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  let schools: any[] = [];
  let departments: any[] = [];
  let entities: string[] = [];
  if (session) {
    schools = filterSchools(session, db.schools());
    const allowedIds = new Set(accessibleSchoolIds(session));
    departments = (db.departments() as any[]).filter((d) => allowedIds.has(d.schoolId));
    entities = [...new Set(schools.map((s: any) => s.entity))];
  }
  return (
    <html lang="ja" className={noto.variable}>
      <body className="font-sans">
        <Shell session={session} schools={schools} departments={departments} entities={entities}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
