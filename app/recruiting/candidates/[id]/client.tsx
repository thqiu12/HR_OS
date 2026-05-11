"use client";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { Sparkles, FileText, Mail, Phone, Calendar, Briefcase, GraduationCap, Award, Upload, AlertCircle, X, Video, MapPin } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { uploadResume, parseResumeAction, parseResumeLocalAction } from "./actions";
import { advanceCandidateStage, rejectCandidate } from "@/lib/actions";
import { scheduleInterviewAction } from "@/lib/interview-actions";
import { useRouter } from "next/navigation";

export default function CandidateClient({
  c, job, schoolName, deptName, resumeFile, files, interviews = [], parsed, parseStatus, parseModel, hasApiKey,
}: {
  c: any; job: any; schoolName: string; deptName: string;
  resumeFile: any; files: any[];
  interviews?: any[];
  parsed: any | null; parseStatus: string | null; parseModel: string | null;
  hasApiKey: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const onSelectFile = (file: File | null) => {
    if (!file) return;
    setErr(null); setInfo(null);
    const fd = new FormData();
    fd.set("candidateId", c.id);
    fd.set("file", file);
    start(async () => {
      const res = await uploadResume(fd);
      if (!res.ok) { setErr(res.error); return; }
      setInfo(`📄 ${res.fileName} をアップロードしました`);
      router.refresh();
    });
    if (fileInput.current) fileInput.current.value = "";
  };

  const onParse = () => {
    if (!resumeFile) { setErr("先に履歴書をアップロードしてください"); return; }
    if (!hasApiKey) { setErr("ANTHROPIC_API_KEY が未設定です。.env で設定してから再試行してください。"); return; }
    setErr(null); setInfo(null);
    start(async () => {
      const res = await parseResumeAction(c.id);
      if (!res.ok) { setErr(res.error); return; }
      setInfo(`✅ ${res.model} で解析完了（${res.tokensIn}入力 / ${res.tokensOut}出力 トークン）`);
      router.refresh();
    });
  };

  const onParseLocal = () => {
    if (!resumeFile) { setErr("先に履歴書をアップロードしてください"); return; }
    setErr(null); setInfo(null);
    start(async () => {
      const res = await parseResumeLocalAction(c.id);
      if (!res.ok) { setErr(res.error); return; }
      const pct = Math.round((res.coverage || 0) * 100);
      setInfo(`✅ ローカル解析完了 (抽出率 ${pct}%) — 内容を確認・編集してください`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <Card className="p-6 flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-400 to-pink-400 text-white flex items-center justify-center text-2xl">{c.flag}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{c.name}</h2>
            <Badge tone="violet">{c.jlpt || "-"}</Badge>
            <Badge tone="indigo">{c.stage}</Badge>
            {parsed && <Badge tone="emerald">AI解析済</Badge>}
          </div>
          <div className="text-sm text-slate-500 mt-0.5">{c.kana} ・ {c.nationality} ・ {c.age}歳</div>
          <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-4 gap-y-1 gap-x-6 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5"><Mail size={12} />{c.email}</span>
            <span className="inline-flex items-center gap-1.5"><Phone size={12} />{c.phone}</span>
            <span className="inline-flex items-center gap-1.5"><Calendar size={12} />応募日 {c.appliedAt}</span>
            <span className="inline-flex items-center gap-1.5"><Briefcase size={12} />{c.experience}</span>
          </div>
          <div className="mt-2 text-xs text-slate-600">
            応募求人：<span className="font-medium text-slate-800">{job?.title}</span>
            {job && <span className="text-slate-400"> ／ {schoolName} ／ {deptName}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            disabled={pending || c.stage === "入社済" || c.stage === "不採用"}
            onClick={() => {
              setErr(null); setInfo(null);
              start(async () => {
                try {
                  const r = await advanceCandidateStage(c.id);
                  if (r.createdOnboardingCaseId) {
                    setInfo(`✅ 「入社手続き」へ移動。入社案件 ${r.createdOnboardingCaseId} を自動作成しました`);
                  } else {
                    setInfo("✅ 次のステージへ移動しました");
                  }
                  router.refresh();
                } catch (e: any) { setErr(e?.message || "移動に失敗しました"); }
              });
            }}
          >
            次のステージへ
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setShowSchedule(true); setErr(null); setInfo(null); }}>面接設定</Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending || c.stage === "不採用"}
            onClick={() => {
              const reason = window.prompt("不採用にする理由を入力してください（任意）", "条件不一致") || "";
              if (!confirm("この候補者を不採用にしますか？")) return;
              setErr(null); setInfo(null);
              start(async () => {
                try { await rejectCandidate(c.id, reason); setInfo("不採用にしました"); router.refresh(); }
                catch (e: any) { setErr(e?.message || "失敗"); }
              });
            }}
          >
            不採用
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="📎 履歴書アップロード と AI解析"
          subtitle="ローカル解析は無料・即時、AI解析は高精度 (¥3-15/件) — まずローカルで試して不足ならAIへ"
          right={
            <div className="flex gap-2 flex-wrap">
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
              />
              <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} disabled={pending}>
                <Upload size={14} />{resumeFile ? "履歴書を差し替え" : "履歴書をアップロード"}
              </Button>
              <button
                onClick={onParseLocal}
                disabled={pending || !resumeFile}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium disabled:opacity-60"
                title="PDFテキストを正規表現で抽出します。コスト ¥0、即時、要確認"
              >
                <Sparkles size={12} />ローカル解析 (無料)
              </button>
              <button
                onClick={onParse}
                disabled={pending || !resumeFile || !hasApiKey}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-md text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                title={hasApiKey ? `Claude ${parseModel || "Opus 4.7"} で高精度解析。¥3-15/件` : "ANTHROPIC_API_KEY を .env に設定すると有効になります"}
              >
                <Sparkles size={12} />
                {!hasApiKey ? "AI解析 (要API設定)" : pending && parseStatus !== "done" ? "解析中..." : parsed ? "AI再解析" : "AI解析"}
              </button>
            </div>
          }
        />
        <div className="p-5 space-y-3">
          {err && (
            <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-lg flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />{err}
            </div>
          )}
          {info && (
            <div className="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-lg">{info}</div>
          )}
          {!resumeFile && !err && !info && (
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
              履歴書PDFをアップロードして「AIで解析」を押すと、学歴・職歴・資格を自動抽出します。
            </div>
          )}
          {files.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {files.map((f) => (
                <div key={f.id} className="border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center"><FileText size={18} /></div>
                  <div className="text-xs flex-1 min-w-0">
                    <div className="font-medium text-slate-800 truncate">{f.originalName}</div>
                    <div className="text-slate-500">{Math.round(f.sizeBytes/1024)}KB ・ {f.uploadedAt?.slice(0,10)}</div>
                  </div>
                  {f.isResume === 1 && <Badge tone="violet" size="xs">履歴書</Badge>}
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {parsed && (
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader
              title={parseModel === "local" ? "🟢 ローカル解析結果" : "🤖 AI解析結果"}
              subtitle={parseStatus === "skipped"
                ? "⚠️ モックデータ (古い結果) — ローカル解析またはAI解析を実行してください"
                : parseModel === "local"
                  ? `pdfjs-dist + 正規表現 (¥0)。内容を確認・編集してください`
                  : `Claude ${parseModel} による構造化抽出`}
            />
            <div className="p-5 space-y-5">
              {parsed.summary && (
                <div className="bg-brand-50 text-brand-900 text-sm p-3 rounded-lg">{parsed.summary}</div>
              )}

              {parsed.education?.length > 0 && (
                <Section icon={<GraduationCap size={16} />} title="学歴">
                  {parsed.education.map((e: any, i: number) => (
                    <Row
                      key={i}
                      date={`${e.period_from || "?"} 〜 ${e.period_to || "?"}`}
                      main={`${e.school}${e.field ? ` ${e.field}` : ""}`}
                      sub={e.degree || ""}
                    />
                  ))}
                </Section>
              )}

              {parsed.career?.length > 0 && (
                <Section icon={<Briefcase size={16} />} title="職歴">
                  {parsed.career.map((c: any, i: number) => (
                    <Row
                      key={i}
                      date={`${c.period_from || "?"} 〜 ${c.period_to || "現在"}`}
                      main={`${c.company}${c.position ? ` / ${c.position}` : ""}`}
                      sub={c.description || ""}
                    />
                  ))}
                </Section>
              )}

              {parsed.qualifications?.length > 0 && (
                <Section icon={<Award size={16} />} title="資格">
                  <div className="flex flex-wrap gap-2">
                    {parsed.qualifications.map((q: any, i: number) => (
                      <Badge key={i} tone="violet">
                        {q.name}{q.acquired_date ? `（${q.acquired_date}）` : ""}
                      </Badge>
                    ))}
                  </div>
                </Section>
              )}

              {parsed.desired_conditions && (parsed.desired_conditions.salary_min || parsed.desired_conditions.work_style) && (
                <Section icon={<Sparkles size={16} />} title="希望条件">
                  <div className="text-xs text-slate-600 space-y-0.5">
                    {parsed.desired_conditions.salary_min && (
                      <div>給与希望：¥{parsed.desired_conditions.salary_min?.toLocaleString()} {parsed.desired_conditions.salary_max ? `〜 ¥${parsed.desired_conditions.salary_max?.toLocaleString()}` : ""}</div>
                    )}
                    {parsed.desired_conditions.work_style && <div>勤務形態：{parsed.desired_conditions.work_style}</div>}
                    {parsed.desired_conditions.notes && <div>備考：{parsed.desired_conditions.notes}</div>}
                  </div>
                </Section>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="🗒 選考メモ・履歴" />
            <div className="p-5 space-y-3 text-sm">
              <Memo who="人事 太郎" when="2026-05-02" text="書類通過。N1取得、教歴3年、すぐに教壇に立てるレベル。" />
              <Memo who="佐藤 一郎" when="2026-05-05" text="一次面接 通過。指導経験豊富で授業案も具体的。" />
              <Memo who="田中 花子" when="2026-05-08" text="模擬授業を実施。生徒目線の説明が丁寧。" />
            </div>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader title={`📅 面接（${interviews.length}件）`} subtitle="面接設定ボタンから新規スケジュール" />
        <div className="divide-y divide-slate-100">
          {interviews.length === 0 && (
            <div className="p-5 text-center text-sm text-slate-400">面接はまだ設定されていません</div>
          )}
          {interviews.map((iv) => (
            <div key={iv.id} className="p-4 flex items-center gap-3">
              <Calendar size={16} className="text-slate-400 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <Badge tone={iv.status === "scheduled" ? "blue" : iv.status === "completed" ? (iv.result === "pass" ? "emerald" : iv.result === "fail" ? "rose" : "amber") : "slate"}>
                    {iv.status === "scheduled" ? "予定" : iv.status === "completed" ? (iv.result === "pass" ? "通過" : iv.result === "fail" ? "見送り" : "保留") : iv.status === "cancelled" ? "キャンセル" : iv.status}
                  </Badge>
                  <Badge tone="violet" size="xs">{iv.round}</Badge>
                  <span className="font-mono text-xs text-slate-600">{new Date(iv.scheduledAt).toLocaleString("ja-JP")}</span>
                  <span className="text-xs text-slate-400">({iv.durationMin}分)</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {iv.format === "online" ? <span className="inline-flex items-center gap-1"><Video size={11} />オンライン</span> : <span className="inline-flex items-center gap-1"><MapPin size={11} />対面</span>}
                  {iv.location && <span className="ml-2">{iv.location}</span>}
                  {iv.interviewerNames && <span className="ml-2">面接官: {iv.interviewerNames}</span>}
                </div>
                {iv.feedback && <div className="mt-1 text-xs text-slate-600 italic">「{iv.feedback}」</div>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <EmailPanel candidateId={c.id} candidateEmail={c.email} />

      {showSchedule && <ScheduleInterviewModal candidateId={c.id} onClose={() => setShowSchedule(false)} onCreated={() => { setShowSchedule(false); setInfo("面接を設定しました"); router.refresh(); }} />}
    </div>
  );
}

function EmailPanel({ candidateId, candidateEmail }: { candidateId: string; candidateEmail: string }) {
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showOffer, setShowOffer] = useState(false);

  const send = (template: string, extra?: any) => {
    setErr(null); setInfo(null);
    start(async () => {
      try {
        const { sendCandidateTemplateEmail } = await import("@/lib/template-email-actions");
        const r = await sendCandidateTemplateEmail({ candidateId, template: template as any, ...(extra || {}) });
        if (r.ok) setInfo(`✅ 送信しました（${r.provider}）: ${r.subject}`);
        else setErr(`送信に失敗しました（${r.provider}）`);
      } catch (e: any) { setErr(e?.message || "失敗"); }
    });
  };

  return (
    <Card>
      <CardHeader title="📧 候補者へメール送信" subtitle={`宛先: ${candidateEmail || "（未登録）"} ／ ANTHROPIC_API_KEY 等同様、未設定時は console fallback`} />
      <div className="p-5 space-y-3">
        {info && <div className="bg-emerald-50 text-emerald-700 text-xs p-2 rounded">{info}</div>}
        {err && <div className="bg-rose-50 text-rose-700 text-xs p-2 rounded">{err}</div>}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => send("applicationReceived")} disabled={pending} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded">📨 応募受付通知</button>
          <button onClick={() => send("interviewSchedule")} disabled={pending} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded">📅 面接案内（直近予定）</button>
          <button onClick={() => setShowOffer(true)} disabled={pending} className="text-xs px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded">🎉 内定通知</button>
          <button onClick={() => { if (confirm("不採用通知を送信しますか？")) send("rejection"); }} disabled={pending} className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded">不採用通知</button>
        </div>
      </div>
      {showOffer && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowOffer(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">🎉 内定通知メールを送信</h3>
              <button onClick={() => setShowOffer(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget as HTMLFormElement);
              setShowOffer(false);
              send("jobOffer", {
                salary: String(fd.get("salary") || ""),
                startDate: String(fd.get("startDate") || ""),
                deadline: String(fd.get("deadline") || ""),
              });
            }} className="space-y-3">
              <div><label className="block text-xs text-slate-500 mb-1">給与（任意）</label><input name="salary" placeholder="月額 280,000円" className="w-full px-3 py-2 border border-slate-200 rounded text-sm" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">入社予定日（任意）</label><input name="startDate" type="date" className="w-full px-3 py-2 border border-slate-200 rounded text-sm" /></div>
              <div><label className="block text-xs text-slate-500 mb-1">回答期限（任意）</label><input name="deadline" type="date" className="w-full px-3 py-2 border border-slate-200 rounded text-sm" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowOffer(false)} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded">キャンセル</button>
                <button type="submit" className="px-3 py-1.5 bg-brand-600 text-white text-xs rounded">送信</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}

function ScheduleInterviewModal({ candidateId, onClose, onCreated }: { candidateId: string; onClose: () => void; onCreated: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [format, setFormat] = useState<"online" | "offline">("online");
  // Default: tomorrow 10:00
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(10, 0, 0, 0);
  const defaultDt = tomorrow.toISOString().slice(0, 16);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErr(null);
    start(async () => {
      try {
        await scheduleInterviewAction({
          candidateId,
          round: String(fd.get("round")),
          scheduledAt: new Date(String(fd.get("scheduledAt"))).toISOString(),
          durationMin: Number(fd.get("durationMin")) || 60,
          format,
          location: String(fd.get("location") || ""),
          interviewerNames: String(fd.get("interviewerNames") || ""),
        });
        onCreated();
      } catch (e: any) { setErr(e?.message || "失敗"); }
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold">📅 面接を設定</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <form className="p-5 space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">回次 *</label>
              <select name="round" required defaultValue="一次面接" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                <option>一次面接</option>
                <option>二次面接</option>
                <option>最終面接</option>
                <option>実技試験</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">時間（分）</label>
              <input name="durationMin" type="number" defaultValue={60} min={15} max={300} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">日時 *</label>
            <input name="scheduledAt" type="datetime-local" required defaultValue={defaultDt} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">形式 *</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setFormat("online")} className={`flex-1 py-2 text-sm rounded-lg ${format === "online" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                <Video size={14} className="inline mr-1" />オンライン
              </button>
              <button type="button" onClick={() => setFormat("offline")} className={`flex-1 py-2 text-sm rounded-lg ${format === "offline" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                <MapPin size={14} className="inline mr-1" />対面
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{format === "online" ? "Meeting URL" : "場所 / 会議室"}</label>
            <input name="location" placeholder={format === "online" ? "https://meet.google.com/xxx" : "本社 第3会議室"} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">面接官（カンマ区切り）</label>
            <input name="interviewerNames" placeholder="佐藤 一郎, 田中 花子" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          {err && <div className="bg-rose-50 text-rose-700 text-xs p-2 rounded-lg">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium disabled:opacity-60">
              {pending ? "設定中..." : "設定"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">{icon}{title}</div>
      <div className="space-y-1.5 pl-6 border-l-2 border-slate-100">{children}</div>
    </div>
  );
}
function Row({ date, main, sub }: { date: string; main: string; sub: string }) {
  return (
    <div className="text-sm">
      <div className="text-xs text-slate-500">{date}</div>
      <div className="font-medium">{main}</div>
      {sub && <div className="text-slate-600 text-xs">{sub}</div>}
    </div>
  );
}
function Memo({ who, when, text }: { who: string; when: string; text: string }) {
  return (
    <div className="border-l-2 border-brand-300 pl-3">
      <div className="text-xs text-slate-500">{who} ・ {when}</div>
      <div className="text-slate-700 mt-0.5">{text}</div>
    </div>
  );
}
