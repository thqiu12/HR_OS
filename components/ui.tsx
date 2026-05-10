import clsx from "clsx";
import { ReactNode } from "react";

export function Forbidden({ message }: { message?: string }) {
  return (
    <div role="alert" aria-live="polite" className="max-w-md mx-auto mt-20 bg-white rounded-2xl shadow-card p-8 text-center">
      <div className="text-4xl" aria-hidden="true">🚫</div>
      <h2 className="mt-4 font-bold text-lg">アクセス権限がありません</h2>
      {message && <p className="mt-2 text-sm text-slate-500">{message}</p>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("bg-white rounded-2xl shadow-card border border-slate-100", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between p-5 border-b border-slate-100">
      <div>
        <h3 className="font-bold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
  size = "sm",
}: {
  children: ReactNode;
  tone?: "slate" | "blue" | "emerald" | "amber" | "rose" | "indigo" | "violet";
  size?: "xs" | "sm";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    indigo: "bg-indigo-100 text-indigo-700",
    violet: "bg-violet-100 text-violet-700",
  };
  const sizes = { xs: "text-[10px] px-1.5 py-0.5", sm: "text-xs px-2 py-0.5" };
  return (
    <span className={clsx("inline-flex items-center rounded-md font-medium", tones[tone], sizes[size])}>
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700",
  };
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm" };
  return (
    <button
      className={clsx("rounded-lg font-medium transition-colors inline-flex items-center gap-1.5", variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={clsx(
          "h-full rounded-full transition-all",
          value < 40 ? "bg-rose-400" : value < 80 ? "bg-amber-400" : "bg-emerald-500"
        )}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { tone: any; label: string }> = {
    "未提出": { tone: "slate", label: "未提出" },
    "提出済": { tone: "blue", label: "提出済" },
    "確認中": { tone: "amber", label: "確認中" },
    "差戻し": { tone: "rose", label: "差戻し" },
    "完了": { tone: "emerald", label: "完了" },
  };
  const m = map[status] || { tone: "slate", label: status };
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
