"use client";
import { Card, CardHeader, Badge } from "@/components/ui";
import { ChevronRight, ChevronDown, Building2, Users, AlertTriangle } from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function OrgTreeClient({ schools, departments, employees, canEdit = false, groupName = "当グループ" }: { schools: any[]; departments: any[]; employees: any[]; canEdit?: boolean; groupName?: string }) {
  const firstSchool = schools[0]?.id;
  const firstDept = firstSchool ? departments.find((d) => d.schoolId === firstSchool)?.id : undefined;
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    firstSchool ? { [firstSchool]: true } : {}
  );
  const [selected, setSelected] = useState<{ schoolId: string; deptId?: string }>({ schoolId: firstSchool || "", deptId: firstDept });

  if (!firstSchool) {
    return <div className="bg-white rounded-2xl shadow-card p-8 text-center text-sm text-slate-500">アクセス可能な組織がありません</div>;
  }

  const groupedByEntity = schools.reduce<Record<string, any[]>>((acc, s) => {
    (acc[s.entity] ||= []).push(s);
    return acc;
  }, {});

  const empsHere = employees.filter(
    (e) => e.schoolId === selected.schoolId && (!selected.deptId || e.departmentId === selected.deptId)
  );

  const deptName = (id?: string) => departments.find((d) => d.id === id)?.name || "";

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-6">
      <Card>
        <CardHeader title="🏢 組織ツリー" subtitle="グループ → 法人 → 学校 → 部門" />
        <div className="p-3 text-sm">
          <div className="font-bold text-slate-700 px-2 py-1.5">▾ {groupName}</div>
          {Object.entries(groupedByEntity).map(([entity, ss]) => (
            <div key={entity} className="ml-3">
              <div className="font-medium text-slate-600 px-2 py-1.5 text-xs">▾ {entity}</div>
              {ss.map((s) => {
                const exp = expanded[s.id];
                const isActive = selected.schoolId === s.id && !selected.deptId;
                return (
                  <div key={s.id} className="ml-3">
                    <button
                      onClick={() => {
                        setExpanded((e) => ({ ...e, [s.id]: !e[s.id] }));
                        setSelected({ schoolId: s.id });
                      }}
                      className={`w-full flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-slate-100 ${isActive ? "bg-brand-50 text-brand-700" : ""}`}
                    >
                      {exp ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <Building2 size={14} />
                      <span>{s.name}</span>
                    </button>
                    {exp &&
                      departments.filter((d) => d.schoolId === s.id).map((d) => {
                        const isDeptActive = selected.schoolId === s.id && selected.deptId === d.id;
                        return (
                          <button
                            key={d.id}
                            onClick={() => setSelected({ schoolId: s.id, deptId: d.id })}
                            className={`w-full flex items-center gap-2 ml-6 px-2 py-1 rounded-md text-xs hover:bg-slate-100 ${isDeptActive ? "bg-brand-50 text-brand-700 font-medium" : "text-slate-600"}`}
                          >
                            <span className="w-1 h-1 rounded-full bg-slate-400" />{d.name}
                          </button>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            selected.deptId
              ? `${schools.find((s) => s.id === selected.schoolId)?.name} / ${deptName(selected.deptId)}`
              : `${schools.find((s) => s.id === selected.schoolId)?.name}`
          }
          subtitle={`所属社員 ${empsHere.length}名`}
          right={
            <div className="flex items-center gap-2">
              <Badge tone="indigo"><Users size={12} className="inline mr-1" />{empsHere.length}</Badge>
              {canEdit && (
                <>
                  <Link href="/organization/employees/new" className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-md hover:bg-brand-700">+ 社員追加</Link>
                  <Link href="/organization/departments" className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md">部門管理</Link>
                </>
              )}
            </div>
          }
        />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-5 py-2 font-medium">氏名</th>
              <th className="text-left px-5 py-2 font-medium">役職</th>
              <th className="text-left px-5 py-2 font-medium">所属種別</th>
              <th className="text-left px-5 py-2 font-medium">直属上司</th>
              <th className="text-left px-5 py-2 font-medium">在留期限</th>
              <th className="text-left px-5 py-2 font-medium">ステータス</th>
              <th className="px-5 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {empsHere.map((e) => {
              const expiringSoon =
                e.zairyuExpiry &&
                new Date(e.zairyuExpiry).getTime() - new Date("2026-05-09").getTime() < 60 * 86400 * 1000;
              const manager = employees.find((x) => x.id === e.managerId);
              return (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-medium">{e.flag} {e.name}</div>
                    <div className="text-xs text-slate-500">{e.kana}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{e.position}</td>
                  <td className="px-5 py-3">
                    {e.assignmentType === "所属" ? (
                      <Badge tone="indigo">★ 主所属</Badge>
                    ) : (
                      <Badge tone="violet">兼任 ({e.costRatio}%)</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{manager?.name || "—"}</td>
                  <td className="px-5 py-3">
                    {e.zairyuExpiry ? (
                      <span className={expiringSoon ? "text-rose-600 font-medium inline-flex items-center gap-1" : ""}>
                        {expiringSoon && <AlertTriangle size={12} />}{e.zairyuExpiry}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={e.status === "在籍" ? "emerald" : e.status === "試用期間" ? "amber" : "slate"}>{e.status}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/organization/employees/${e.id}`} className="text-brand-600 text-xs hover:underline">詳細</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
