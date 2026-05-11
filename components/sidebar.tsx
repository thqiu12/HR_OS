"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, ClipboardList, Building2, LineChart, Bell, Settings, GraduationCap, X,
} from "lucide-react";
import clsx from "clsx";
import type { Session } from "next-auth";
import { useEffect } from "react";

type NavItem = { href: string; label: string; labelKey?: string; icon: any; mod: string; match?: string; children?: { href: string; label: string }[] };
const items: NavItem[] = [
  { href: "/dashboard", label: "ダッシュボード", icon: LayoutDashboard, mod: "dashboard" },
  { href: "/recruiting/pipeline", label: "採用管理", icon: Users, match: "/recruiting", mod: "recruiting",
    children: [
      { href: "/recruiting/pipeline", label: "選考パイプライン" },
      { href: "/recruiting/jobs", label: "求人一覧" },
      { href: "/recruiting/candidates", label: "候補者一覧" },
      { href: "/recruiting/interviews", label: "面接スケジュール" },
    ] },
  { href: "/onboarding/cases", label: "入社手続き", icon: ClipboardList, match: "/onboarding", mod: "onboarding" },
  { href: "/staffing/shifts", label: "シフト・給与", icon: ClipboardList, match: "/staffing", mod: "recruiting",
    children: [
      { href: "/staffing/shifts", label: "シフト管理" },
      { href: "/staffing/shifts/patterns", label: "週次パターン" },
      { href: "/staffing/payroll", label: "給与計算" },
    ] },
  { href: "/organization/tree", label: "組織管理", icon: Building2, match: "/organization", mod: "organization",
    children: [
      { href: "/organization/tree", label: "組織ツリー" },
      { href: "/organization/employees", label: "社員一覧" },
      { href: "/organization/departments", label: "部門マスタ" },
      { href: "/organization/schools", label: "学校マスタ" },
    ] },
  { href: "/performance/profiles", label: "評価管理", icon: LineChart, match: "/performance", mod: "performance",
    children: [
      { href: "/performance/profiles", label: "評価カルテ" },
      { href: "/performance/calibration", label: "評価会議" },
    ] },
  { href: "/reminders", label: "リマインダー", icon: Bell, mod: "reminders" },
  { href: "/settings", label: "設定", icon: Settings, mod: "settings",
    children: [
      { href: "/settings", label: "概要" },
      { href: "/settings/users", label: "ユーザー" },
      { href: "/settings/2fa", label: "2FA" },
      { href: "/settings/wage-types", label: "賃率マスタ" },
      { href: "/settings/metrics", label: "メトリクス" },
      { href: "/settings/audit", label: "監査ログ" },
      { href: "/settings/usage", label: "API使用量" },
    ] },
];

const ROLE_LABEL: Record<string, string> = {
  group_admin: "グループ管理者",
  entity_hr: "法人HR管理者",
  school_hr: "学校HR担当",
  principal: "校長 / 学校長",
  manager: "部門長",
  employee: "一般社員",
  executive: "経営層",
};

function canSee(roles: { role: string }[], mod: string): boolean {
  const has = (r: string) => roles.some((x) => x.role === r);
  if (has("group_admin") || has("executive") || has("auditor")) return true;
  switch (mod) {
    case "settings": return ["group_admin"].some(has);
    case "reminders": return !has("employee") || has("manager");
    case "recruiting":
    case "onboarding": return ["entity_hr", "school_hr", "principal", "manager"].some(has);
    case "performance": return ["entity_hr", "school_hr", "principal", "manager", "employee"].some(has);
    case "organization": return true;
    case "dashboard": return true;
    default: return false;
  }
}

function highest(roles: { role: string }[]): string {
  const order = ["group_admin", "entity_hr", "school_hr", "principal", "manager", "employee", "executive"];
  for (const r of order) if (roles.some((x) => x.role === r)) return ROLE_LABEL[r];
  return "—";
}

export function Sidebar({ session, mobileOpen, onCloseMobile }: { session: Session; mobileOpen?: boolean; onCloseMobile?: () => void }) {
  const pathname = usePathname();
  const visible = items.filter((i) => canSee(session.roles, i.mod));

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  // Close drawer when route changes
  useEffect(() => {
    if (mobileOpen) onCloseMobile?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const navContent = (
    <>
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
            <GraduationCap size={18} />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">HR OS</div>
            <div className="text-[11px] text-slate-500 leading-tight">グループ統合人事</div>
          </div>
        </div>
        {mobileOpen && (
          <button onClick={onCloseMobile} className="md:hidden p-2 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visible.map((it) => {
          const active = pathname === it.href || (it.match && pathname.startsWith(it.match));
          const Icon = it.icon;
          return (
            <div key={it.href}>
              <Link
                href={it.href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  active ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                <Icon size={18} />
                {it.label}
              </Link>
              {active && it.children && (
                <div className="ml-9 mt-0.5 mb-1 space-y-0.5">
                  {it.children.map((c) => {
                    const isActive = pathname === c.href;
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={clsx(
                          "block px-3 py-1 text-xs rounded",
                          isActive ? "text-brand-700 font-medium bg-brand-50" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        {c.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-200">
        <div className="px-2 py-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-pink-400 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {session.user.name?.charAt(0)}
            </div>
            <div className="text-xs min-w-0">
              <div className="font-medium truncate">{session.user.name}</div>
              <div className="text-slate-500 truncate">{highest(session.roles)}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex w-60 bg-white border-r border-slate-200 flex-col shrink-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50" onClick={onCloseMobile} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col shadow-xl">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
