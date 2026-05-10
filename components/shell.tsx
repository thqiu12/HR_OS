"use client";
import type { Session } from "next-auth";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function Shell({
  session, children,
  schools = [], departments = [], entities = [],
}: {
  session: Session | null;
  children: React.ReactNode;
  schools?: any[];
  departments?: any[];
  entities?: string[];
}) {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname.startsWith("/onboarding/invite");
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (isAuthRoute || !session) return <>{children}</>;

  return (
    <div className="flex min-h-screen">
      <Sidebar session={session} mobileOpen={drawerOpen} onCloseMobile={() => setDrawerOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          session={session}
          schools={schools}
          departments={departments}
          entities={entities}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
