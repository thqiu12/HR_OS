"use client";
import { Bell, Search, ChevronDown, LogOut, X, AlertTriangle, IdCard, Clock, Menu, KeyRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Session } from "next-auth";
import { useEffect, useRef, useState, useTransition } from "react";
import { logoutAction } from "@/app/login/actions";
import Link from "next/link";

const titles: Record<string, string> = {
  "/dashboard": "ダッシュボード",
  "/recruiting/pipeline": "採用管理 / 選考パイプライン",
  "/recruiting/jobs": "採用管理 / 求人一覧",
  "/recruiting/candidates": "採用管理 / 候補者一覧",
  "/onboarding/cases": "入社手続き / 案件一覧",
  "/organization/tree": "組織管理 / 組織ツリー",
  "/organization/employees": "組織管理 / 社員一覧",
  "/organization/departments": "組織管理 / 部門マスタ",
  "/performance/profiles": "評価管理 / カルテ一覧",
  "/reminders": "リマインダーセンター",
  "/settings/audit": "設定 / 監査ログ",
  "/settings/usage": "設定 / API使用量",
  "/settings/users": "設定 / ユーザー管理",
  "/settings/password": "設定 / パスワード変更",
  "/settings/2fa": "設定 / 2段階認証",
  "/settings": "設定",
};

const PERIODS = [
  { value: "today", label: "今日" },
  { value: "this_week", label: "今週" },
  { value: "this_month", label: "今月" },
  { value: "last_30d", label: "直近30日" },
  { value: "this_quarter", label: "今四半期" },
  { value: "this_year", label: "今年" },
  { value: "all", label: "全期間" },
];

export function Topbar({ session, schools = [], departments = [], entities = [], onOpenDrawer }: {
  session: Session;
  schools?: { id: string; name: string; entity: string }[];
  departments?: { id: string; schoolId: string; name: string }[];
  entities?: string[];
  onOpenDrawer?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const matched = Object.keys(titles).find((k) => pathname.startsWith(k)) || "/dashboard";
  const title = titles[matched] || "HR OS";

  const entity = params.get("entity") || "";
  const school = params.get("school") || "";
  const dept = params.get("dept") || "";
  const period = params.get("period") || "this_month";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (!value) next.delete(key);
    else next.set(key, value);
    // Cascading: changing entity clears school+dept; changing school clears dept
    if (key === "entity") { next.delete("school"); next.delete("dept"); }
    if (key === "school") { next.delete("dept"); }
    router.push(`${pathname}?${next.toString()}`);
  };

  const handleLogout = () => {
    start(async () => { await logoutAction(); router.push("/login"); router.refresh(); });
  };

  const filteredSchools = entity ? schools.filter((s) => s.entity === entity) : schools;
  const filteredDepts = school ? departments.filter((d) => d.schoolId === school) : [];

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center gap-2 md:gap-4 shrink-0 relative">
      <button onClick={onOpenDrawer} className="md:hidden p-2 rounded-lg hover:bg-slate-100">
        <Menu size={18} />
      </button>
      <h1 className="font-bold text-slate-800 text-sm md:text-base truncate">{title}</h1>

      <div className="hidden md:flex items-center gap-2 ml-4">
        <FilterDropdown
          label="法人"
          value={entity}
          options={[{ value: "", label: "全て" }, ...entities.map((e) => ({ value: e, label: e }))]}
          onChange={(v) => setParam("entity", v)}
        />
        <FilterDropdown
          label="学校"
          value={school}
          options={[{ value: "", label: "全て" }, ...filteredSchools.map((s) => ({ value: s.id, label: s.name }))]}
          onChange={(v) => setParam("school", v)}
        />
        <FilterDropdown
          label="部門"
          value={dept}
          options={[
            { value: "", label: school ? "全て" : "（学校を選択）" },
            ...filteredDepts.map((d) => ({ value: d.id, label: d.name })),
          ]}
          disabled={!school}
          onChange={(v) => setParam("dept", v)}
        />
        <FilterDropdown
          label="期間"
          value={period}
          options={PERIODS}
          onChange={(v) => setParam("period", v)}
        />
        {(entity || school || dept || period !== "this_month") && (
          <button
            onClick={() => router.push(pathname)}
            className="text-[11px] text-rose-600 hover:underline"
            title="フィルターをクリア"
          >クリア</button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <SearchBox />
        <BellDropdown session={session} />

        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-pink-400 text-white flex items-center justify-center text-xs font-bold">
              {session.user.name?.charAt(0)}
            </div>
            <span className="text-sm font-medium hidden lg:inline">{session.user.loginId}</span>
            <ChevronDown size={14} className="text-slate-400" />
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <div className="font-medium text-sm">{session.user.name}</div>
                  <div className="text-xs text-slate-500">{session.user.email}</div>
                </div>
                <div className="p-3 border-b border-slate-100">
                  <div className="text-[10px] uppercase text-slate-400 font-semibold mb-2">付与ロール</div>
                  <div className="space-y-1">
                    {session.roles.map((r, i) => (
                      <div key={i} className="text-xs flex justify-between items-center">
                        <span className="font-medium">{r.role}</span>
                        <span className="text-slate-500">{r.scopeType}{r.scopeId ? `: ${r.scopeId}` : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <Link
                  href="/settings/password"
                  onClick={() => setOpen(false)}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 border-b border-slate-100"
                >
                  <KeyRound size={14} />
                  パスワード変更
                </Link>
                <Link
                  href="/settings/2fa"
                  onClick={() => setOpen(false)}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 border-b border-slate-100"
                >
                  <span className="w-[14px] inline-flex justify-center text-[14px] leading-none">🔐</span>
                  2段階認証(2FA)
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={pending}
                  className="w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <LogOut size={14} />
                  {pending ? "ログアウト中..." : "ログアウト"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function FilterDropdown({ label, value, options, onChange, disabled }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);
  const current = options.find((o) => o.value === value)?.label || options[0]?.label || "—";
  const isFilteredAway = value && !options.some((o) => o.value === value);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-md ${
          disabled ? "bg-slate-50 text-slate-400 cursor-not-allowed" :
          value ? "bg-brand-50 text-brand-700 hover:bg-brand-100" : "bg-slate-100 hover:bg-slate-200 text-slate-700"
        }`}
      >
        <span className="text-slate-500">{label}</span>
        <span className="font-medium">{isFilteredAway ? "（範囲外）" : current}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[200px] max-h-80 overflow-y-auto bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 ${o.value === value ? "bg-brand-50 text-brand-700 font-medium" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  useEffect(() => {
    if (!q || q.length < 1) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (r.ok) {
          const d = await r.json();
          setResults(d.results || []);
        }
      } catch {}
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  return (
    <div className="relative hidden lg:block" ref={ref}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="社員・候補者を検索"
        className="pl-9 pr-3 py-2 text-sm bg-slate-100 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
      />
      {open && q && (
        <div className="absolute top-full right-0 mt-1 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-slate-200 z-50">
          {results.length === 0 ? (
            <div className="p-3 text-xs text-slate-400 text-center">該当なし</div>
          ) : (
            results.map((r: any) => (
              <Link
                key={r.kind + ":" + r.id}
                href={r.href}
                onClick={() => { setOpen(false); setQ(""); }}
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0"
              >
                <span className="text-xs px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded uppercase">{r.kind}</span>
                <span className="font-medium">{r.label}</span>
                <span className="text-xs text-slate-400 ml-auto">{r.sub}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function BellDropdown({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ count: number; items: any[] } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notifications").then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    if (open) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-slate-100">
        <Bell size={18} />
        {(data?.count ?? 0) > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {data!.count > 99 ? "99+" : data!.count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="font-bold text-sm">未対応リマインダー</div>
            <Link href="/reminders" className="text-xs text-brand-600 hover:underline">すべて見る</Link>
          </div>
          {!data ? (
            <div className="p-4 text-xs text-slate-400 text-center">読み込み中...</div>
          ) : data.items.length === 0 ? (
            <div className="p-6 text-xs text-slate-400 text-center">未対応の通知はありません 🎉</div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {data.items.map((r: any) => {
                const Icon = r.category === "在留カード期限" ? IdCard
                  : r.category === "試用期間終了" ? Clock
                  : AlertTriangle;
                const tone = r.severity === "critical" ? "text-rose-600 bg-rose-50"
                  : r.severity === "warn" ? "text-amber-600 bg-amber-50"
                  : "text-blue-600 bg-blue-50";
                return (
                  <Link
                    key={r.id}
                    href="/reminders"
                    className="flex items-start gap-3 p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                    onClick={() => setOpen(false)}
                  >
                    <div className={`w-8 h-8 rounded-lg ${tone} flex items-center justify-center shrink-0`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{r.title}</div>
                      <div className="text-[10px] text-slate-500 truncate">{r.detail}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
