"use client";
import { Card, CardHeader, Badge, Button } from "@/components/ui";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Upload, AlertTriangle, Check, FileText, Download } from "lucide-react";
import { previewEmployeeCsv, commitEmployeeImport } from "./actions";

const SAMPLE = `empNo,name,kana,romaji,nationality,email,schoolId,departmentId,position,hireRoute,hireDate,probationEnd,zairyuExpiry
S0900,山田 太郎,ヤマダ タロウ,Yamada Taro,日本,t.yamada@sakura.jp,s1,d1,常勤講師,中途,2026-06-01,2026-12-01,
S0901,Pham Quoc Anh,ファム クォック アン,Pham Quoc Anh,ベトナム,quoc@sakura.jp,s2,d4,非常勤講師,中途,2026-07-01,2027-01-01,2028-03-15
`;

export default function ImportClient() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | null) => {
    if (!file) return;
    setErr(null);
    const text = await file.text();
    setCsvText(text);
    runPreview(text);
  };

  const runPreview = (text: string) => {
    setErr(null); setInfo(null);
    start(async () => {
      try { const p = await previewEmployeeCsv(text); setPreview(p); }
      catch (e: any) { setErr(e?.message || "プレビューに失敗"); setPreview(null); }
    });
  };

  const onCommit = () => {
    setErr(null); setInfo(null);
    if (!preview || preview.ok === 0) { setErr("インポートできる行がありません"); return; }
    if (!confirm(`${preview.ok}件をインポートします（NG ${preview.ng}件はスキップ）。よろしいですか？`)) return;
    start(async () => {
      try {
        const r = await commitEmployeeImport(csvText);
        setInfo(`✅ ${r.inserted}件インポートしました（${r.skipped}件スキップ）`);
        setPreview(null); setCsvText("");
        router.refresh();
      } catch (e: any) { setErr(e?.message || "インポートに失敗"); }
    });
  };

  return (
    <div className="max-w-5xl space-y-4">
      <Link href="/organization/employees" className="text-sm text-brand-600 hover:underline">← 社員一覧へ戻る</Link>

      <Card>
        <CardHeader title="📥 社員 CSV インポート" subtitle="UTF-8 / 1行目はヘッダー / 必須項目: empNo, name, kana, schoolId, departmentId, position, hireRoute, hireDate, probationEnd" />
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-lg text-sm hover:bg-brand-700">
              <Upload size={14} />CSVファイルを選択
            </button>
            <a
              href={"data:text/csv;charset=utf-8," + encodeURIComponent(SAMPLE)}
              download="employees-sample.csv"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs hover:bg-slate-200"
            >
              <Download size={12} />サンプル CSV をダウンロード
            </a>
            <button onClick={() => { setCsvText(SAMPLE); runPreview(SAMPLE); }} className="text-xs text-brand-600 hover:underline">サンプルを試す</button>
          </div>

          {csvText && (
            <details>
              <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">CSV テキスト ({csvText.split("\n").length} 行)</summary>
              <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} onBlur={() => runPreview(csvText)}
                        className="mt-2 w-full h-40 px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono" />
            </details>
          )}

          {err && <div className="bg-rose-50 text-rose-700 text-xs p-3 rounded-lg flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{err}</div>}
          {info && <div className="bg-emerald-50 text-emerald-700 text-xs p-3 rounded-lg flex items-start gap-2"><Check size={14} className="mt-0.5 shrink-0" />{info}</div>}

          {preview && (
            <>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <FileText size={18} className="text-slate-500" />
                <div className="flex-1">
                  <div className="text-sm font-medium">プレビュー結果</div>
                  <div className="text-xs text-slate-500">
                    合計 {preview.rows.length}行 ／ <span className="text-emerald-700 font-medium">OK {preview.ok}</span> ／ <span className="text-rose-700 font-medium">NG {preview.ng}</span>
                  </div>
                </div>
                <Button onClick={onCommit} disabled={pending || preview.ok === 0}>
                  {pending ? "実行中..." : `${preview.ok}件をインポート`}
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left px-3 py-2">行</th>
                      <th className="text-left px-3 py-2">状態</th>
                      <th className="text-left px-3 py-2">社員番号</th>
                      <th className="text-left px-3 py-2">氏名</th>
                      <th className="text-left px-3 py-2">学校 / 部門</th>
                      <th className="text-left px-3 py-2">役職</th>
                      <th className="text-left px-3 py-2">エラー</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.map((r: any) => (
                      <tr key={r.rowIndex} className={r.ok ? "" : "bg-rose-50"}>
                        <td className="px-3 py-2 font-mono text-[10px]">{r.rowIndex}</td>
                        <td className="px-3 py-2">{r.ok ? <Badge tone="emerald" size="xs">OK</Badge> : <Badge tone="rose" size="xs">NG</Badge>}</td>
                        <td className="px-3 py-2 font-mono">{r.raw.empNo}</td>
                        <td className="px-3 py-2">{r.raw.name}</td>
                        <td className="px-3 py-2">{r.raw.schoolId} / {r.raw.departmentId}</td>
                        <td className="px-3 py-2">{r.raw.position}</td>
                        <td className="px-3 py-2 text-rose-700">{r.errors.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
