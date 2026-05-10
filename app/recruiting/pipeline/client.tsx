"use client";
import { Card, Badge, Button } from "@/components/ui";
import { stages } from "@/lib/mock";
import { Paperclip, Plus, Filter, Sparkles } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { moveCandidateStage } from "@/lib/actions";
import { useRouter } from "next/navigation";

export default function PipelineClient({ candidates, jobs, schools, canMove }: { candidates: any[]; jobs: any[]; schools: any[]; canMove: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<any[]>(candidates);
  const [jobFilter, setJobFilter] = useState<string>("all");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (jobFilter === "all" ? items : items.filter((c) => c.jobId === jobFilter)),
    [items, jobFilter]
  );

  const handleDrop = (stage: string) => {
    if (!draggingId || !canMove) return;
    const id = draggingId;
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)));
    setDraggingId(null);
    startTransition(async () => {
      await moveCandidateStage(id, stage);
      router.refresh();
    });
  };

  const schoolName = (id: string) => schools.find((s) => s.id === id)?.name || "";

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center gap-3 flex-wrap">
        <Filter size={16} className="text-slate-500" />
        <span className="text-sm font-medium">求人フィルター：</span>
        <select
          value={jobFilter}
          onChange={(e) => setJobFilter(e.target.value)}
          className="text-sm border border-slate-200 rounded-md px-3 py-1.5 bg-white"
        >
          <option value="all">すべての求人</option>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>[{schoolName(j.schoolId)}] {j.title}</option>
          ))}
        </select>
        {pending && <span className="text-xs text-brand-600">保存中...</span>}
        <div className="ml-auto flex gap-2">
          <Link href="/recruiting/jobs/new" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-lg font-medium">
            <Plus size={14} />求人を作成
          </Link>
        </div>
      </Card>

      <div className="overflow-x-auto pb-4 -mx-6 px-6">
        <div className="flex gap-3 min-w-max">
          {stages.map((s) => {
            const list = filtered.filter((c) => c.stage === s);
            return (
              <div
                key={s}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(s)}
                className="w-72 shrink-0 bg-slate-100/70 rounded-xl p-2"
              >
                <div className="flex items-center justify-between px-2 py-2">
                  <div className="font-bold text-sm text-slate-700">{s}</div>
                  <Badge tone="slate">{list.length}</Badge>
                </div>
                <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin pr-1">
                  {list.map((c) => (
                    <div
                      key={c.id}
                      draggable={canMove}
                      onDragStart={() => canMove && setDraggingId(c.id)}
                      className="bg-white rounded-lg p-3 shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing hover:border-brand-300 transition-colors"
                    >
                      <Link href={`/recruiting/candidates/${c.id}`} className="block">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-medium text-sm">{c.flag} {c.name}</div>
                            <div className="text-[11px] text-slate-500">{c.kana}</div>
                          </div>
                          {c.jlpt && <Badge tone="violet" size="xs">{c.jlpt}</Badge>}
                        </div>
                        <div className="mt-2 text-[11px] text-slate-600 truncate">
                          {jobs.find((j) => j.id === c.jobId)?.title}
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1"><Paperclip size={11} />{c.attachments}</span>
                          <span>{String(c.appliedAt).slice(5)}</span>
                          <span className="ml-auto inline-flex items-center gap-1 text-brand-600">
                            <Sparkles size={11} />AI解析
                          </span>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
