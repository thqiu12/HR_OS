"use client";
import { Card, CardHeader, Badge, Progress } from "@/components/ui";
import {
  Users, Briefcase, Award, UserPlus, Building2, AlertTriangle, ChevronRight, IdCard, Clock, GripVertical, Save, RotateCcw,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import Link from "next/link";
import { useState, useTransition, useEffect } from "react";
import { setUserPrefAction } from "@/lib/preferences-actions";

type Props = {
  kpi: { openJobs: number; inProcess: number; naitei: number; joined: number; totalEmp: number };
  funnel: { stage: string; count: number }[];
  schoolStat: { name: string; count: number }[];
  alerts: { expiring: number; probation: number; rejected: number };
  onboardingCases: any[];
  kpiOrder?: string[] | null;
  showRecruiting?: boolean;
  showOnboarding?: boolean;
  showReminders?: boolean;
};

const DEFAULT_ORDER = ["openJobs", "inProcess", "naitei", "joined", "totalEmp"];
const KPI_DEFS: Record<string, { icon: React.ReactNode; label: string; unit: string; tone: any }> = {
  openJobs: { icon: <Briefcase size={18} />, label: "公開求人", unit: "件", tone: "indigo" },
  inProcess: { icon: <Users size={18} />, label: "選考中", unit: "名", tone: "violet" },
  naitei: { icon: <Award size={18} />, label: "今月内定", unit: "名", tone: "emerald" },
  joined: { icon: <UserPlus size={18} />, label: "今月入社", unit: "名", tone: "blue" },
  totalEmp: { icon: <Building2 size={18} />, label: "総社員数", unit: "名", tone: "amber" },
};

export default function DashboardClient({ kpi, funnel, schoolStat, alerts, onboardingCases, kpiOrder, showRecruiting = true, showOnboarding = true, showReminders = true }: Props) {
  // Use saved order if available, fallback to default; ensure all 5 keys present
  const initialOrder = (() => {
    const saved = (kpiOrder || []).filter((k) => DEFAULT_ORDER.includes(k));
    const missing = DEFAULT_ORDER.filter((k) => !saved.includes(k));
    return [...saved, ...missing];
  })();

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [draggedKey, setDraggedKey] = useState<string | null>(null);

  const onDrop = (target: string) => {
    if (!draggedKey || draggedKey === target) return;
    setOrder((prev) => {
      const without = prev.filter((k) => k !== draggedKey);
      const i = without.indexOf(target);
      return [...without.slice(0, i), draggedKey, ...without.slice(i)];
    });
    setDraggedKey(null);
  };

  const save = () => {
    start(async () => {
      try { await setUserPrefAction("dashboard.kpiOrder", JSON.stringify(order)); setEditing(false); }
      catch (e) { console.error(e); }
    });
  };

  const reset = () => {
    setOrder(DEFAULT_ORDER);
    start(async () => {
      try { await setUserPrefAction("dashboard.kpiOrder", JSON.stringify(DEFAULT_ORDER)); setEditing(false); }
      catch (e) { console.error(e); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        {editing ? (
          <>
            <button onClick={reset} disabled={pending} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md inline-flex items-center gap-1">
              <RotateCcw size={12} />初期順に戻す
            </button>
            <button onClick={save} disabled={pending} className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md inline-flex items-center gap-1 disabled:opacity-60">
              <Save size={12} />{pending ? "保存中..." : "保存して終了"}
            </button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md inline-flex items-center gap-1">
            <GripVertical size={12} />KPIカードを並び替え
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {order.map((key) => {
          const def = KPI_DEFS[key];
          const value = (kpi as any)[key];
          return (
            <div
              key={key}
              draggable={editing}
              onDragStart={() => setDraggedKey(key)}
              onDragOver={(e) => editing && e.preventDefault()}
              onDrop={() => onDrop(key)}
              className={editing ? "cursor-move ring-2 ring-brand-200 rounded-2xl" : ""}
            >
              <KpiCard icon={def.icon} label={def.label} value={value} unit={def.unit} tone={def.tone} editing={editing} />
            </div>
          );
        })}
      </div>

      {showReminders && (
        <Card>
          <CardHeader
            title="🔔 緊急アラート"
            subtitle="集団全体で対応が必要な事項です"
            right={<Link href="/reminders" className="text-xs text-brand-600 hover:underline">すべて見る →</Link>}
          />
          <div className="grid md:grid-cols-3 gap-px bg-slate-100">
            <AlertCell icon={<IdCard size={20} className="text-rose-600" />} title="在留カード期限切れ" count={alerts.expiring} tone="rose" sub="30日以内" />
            <AlertCell icon={<Clock size={20} className="text-amber-600" />} title="試用期間 終了直前" count={alerts.probation} tone="amber" sub="2週間〜1か月以内" />
            <AlertCell icon={<AlertTriangle size={20} className="text-rose-600" />} title="入社書類 差戻し中" count={alerts.rejected} tone="rose" sub="再提出待ち" />
          </div>
        </Card>
      )}

      <div className={`grid ${showRecruiting ? "lg:grid-cols-2" : "lg:grid-cols-1"} gap-6`}>
        {showRecruiting && (
          <Card>
            <CardHeader title="📊 採用ファネル" subtitle="ステージ別 候補者数" />
            <div className="p-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="stage" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {funnel.map((_, i) => <Cell key={i} fill={`hsl(${230 + i * 8}, 70%, ${75 - i * 4}%)`} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
        <Card>
          <CardHeader title="🏫 学校別 社員数" />
          <div className="p-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={schoolStat} margin={{ left: 0, right: 20 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} dy={10} height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {showOnboarding && (
      <Card>
        <CardHeader title="📋 入社手続き 進捗" right={<Link href="/onboarding/cases" className="text-xs text-brand-600 hover:underline">案件一覧へ →</Link>} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-5 py-2 font-medium">氏名</th>
                <th className="text-left px-5 py-2 font-medium">学校</th>
                <th className="text-left px-5 py-2 font-medium">入社予定日</th>
                <th className="text-left px-5 py-2 font-medium">ルート</th>
                <th className="text-left px-5 py-2 font-medium w-64">進捗</th>
                <th className="text-left px-5 py-2 font-medium">ステータス</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {onboardingCases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium">{c.flag} {c.candidateName}</td>
                  <td className="px-5 py-3 text-slate-600">{c.schoolName}</td>
                  <td className="px-5 py-3">{c.expectedJoinDate}</td>
                  <td className="px-5 py-3"><Badge tone={c.route === "新卒" ? "blue" : "violet"}>{c.route}</Badge></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Progress value={c.progress} />
                      <span className="text-xs text-slate-500 w-10 text-right">{c.progress}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={c.status === "完了" ? "emerald" : c.status === "HR確認中" ? "amber" : "slate"}>{c.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/onboarding/cases/${c.id}`} className="text-brand-600 inline-flex items-center text-xs hover:underline">
                      詳細<ChevronRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, unit, tone, editing }: any) {
  const tones: any = {
    indigo: "from-indigo-500 to-indigo-600",
    violet: "from-violet-500 to-violet-600",
    emerald: "from-emerald-500 to-emerald-600",
    blue: "from-blue-500 to-blue-600",
    amber: "from-amber-500 to-amber-600",
  };
  return (
    <Card className="p-4 flex items-center gap-3">
      {editing && <GripVertical size={16} className="text-slate-300" />}
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tones[tone]} text-white flex items-center justify-center`}>{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="font-bold text-slate-800"><span className="text-2xl">{value}</span><span className="text-xs text-slate-500 ml-1">{unit}</span></div>
      </div>
    </Card>
  );
}

function AlertCell({ icon, title, count, sub, tone }: any) {
  return (
    <div className="bg-white p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${tone === "rose" ? "bg-rose-50" : "bg-amber-50"} flex items-center justify-center`}>{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-800">{title}</div>
        <div className="text-xs text-slate-500">{sub}</div>
      </div>
      <div className={`text-3xl font-bold ${tone === "rose" ? "text-rose-600" : "text-amber-600"}`}>{count}</div>
      <Link href="/reminders" className="text-slate-400 hover:text-slate-600"><ChevronRight size={18} /></Link>
    </div>
  );
}
