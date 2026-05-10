"use client";
import { Card, CardHeader, Badge } from "@/components/ui";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, History } from "lucide-react";
import { addEmployeeWageRateAction, endEmployeeWageRateAction } from "@/lib/wage-actions";

const UNIT_LABEL: Record<string, string> = { hour: "時給", class: "コマ給", day: "日給", fixed: "固定" };

export default function WageRatesSection({
  employeeId, activeRates, history, availableTypes, canEdit,
}: {
  employeeId: string;
  activeRates: any[];
  history: any[];
  availableTypes: any[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onEnd = (rate: any) => {
    const today = new Date().toISOString().slice(0, 10);
    const at = prompt(`「${rate.typeName}」を終了する日付 (YYYY-MM-DD)`, today);
    if (!at) return;
    setErr(null);
    start(async () => {
      try {
        await endEmployeeWageRateAction(rate.id, employeeId, at);
        router.refresh();
      } catch (e: any) { setErr(e?.message); }
    });
  };

  return (
    <Card>
      <CardHeader
        title="💴 賃率"
        subtitle="授業時給 / 事務時給 などの種別ごとに管理 (履歴保持)"
        right={
          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1">
              <History size={12} />履歴 {showHistory ? "▲" : "▼"}
            </button>
            {canEdit && (
              <button onClick={() => { setShowAdd(true); setErr(null); }} className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-md text-xs font-medium inline-flex items-center gap-1">
                <Plus size={12} />賃率を追加
              </button>
            )}
          </div>
        }
      />
      <div className="p-5">
        {err && <div className="bg-rose-50 text-rose-700 text-xs p-2 rounded mb-3">{err}</div>}

        {activeRates.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">
            適用中の賃率がありません。{canEdit && "「賃率を追加」から登録してください。"}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2 font-medium">賃率種別</th>
                <th className="text-left px-3 py-2 font-medium">単位</th>
                <th className="text-right px-3 py-2 font-medium">金額</th>
                <th className="text-left px-3 py-2 font-medium">適用開始</th>
                <th className="text-left px-3 py-2 font-medium">備考</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeRates.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{r.typeName}</td>
                  <td className="px-3 py-2"><Badge tone="indigo" size="xs">{UNIT_LABEL[r.typeUnit] || r.typeUnit}</Badge></td>
                  <td className="px-3 py-2 text-right font-mono font-bold">¥{Number(r.amount).toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{r.effectiveFrom}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{r.notes || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {canEdit && (
                      <button onClick={() => onEnd(r)} className="text-xs text-rose-600 hover:underline" disabled={pending}>
                        終了
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {showHistory && (
          <details open className="mt-4 border-t border-slate-100 pt-3">
            <summary className="text-xs text-slate-500 mb-2 cursor-pointer hover:text-slate-700">
              📜 過去の賃率履歴 (全 {history.length} 件)
            </summary>
            <table className="w-full text-xs mt-2">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left px-2 py-1">種別</th>
                  <th className="text-right px-2 py-1">金額</th>
                  <th className="text-left px-2 py-1">期間</th>
                  <th className="text-left px-2 py-1">備考</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-slate-50">
                    <td className="px-2 py-1">{h.typeName}</td>
                    <td className="px-2 py-1 text-right font-mono">¥{Number(h.amount).toLocaleString()}</td>
                    <td className="px-2 py-1 text-slate-500">{h.effectiveFrom} 〜 {h.effectiveTo || "現在"}</td>
                    <td className="px-2 py-1 text-slate-500">{h.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </div>

      {showAdd && (
        <AddRateModal
          employeeId={employeeId}
          availableTypes={availableTypes}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); router.refresh(); }}
        />
      )}
    </Card>
  );
}

function AddRateModal({
  employeeId, availableTypes, onClose, onAdded,
}: {
  employeeId: string;
  availableTypes: any[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [pending, start] = useTransition();
  const [typeId, setTypeId] = useState<number>(availableTypes[0]?.id ?? 0);
  const [err, setErr] = useState<string | null>(null);

  const selected = availableTypes.find((t) => t.id === typeId);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold">💴 賃率を追加</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <form
          className="p-5 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setErr(null);
            start(async () => {
              try {
                await addEmployeeWageRateAction({
                  employeeId,
                  rateTypeId: Number(fd.get("rateTypeId")),
                  amount: Number(fd.get("amount")),
                  effectiveFrom: String(fd.get("effectiveFrom")),
                  notes: String(fd.get("notes") || ""),
                });
                onAdded();
              } catch (e: any) { setErr(e?.message); }
            });
          }}
        >
          <div>
            <label className="block text-xs text-slate-500 mb-1">賃率種別</label>
            <select name="rateTypeId" value={typeId} onChange={(e) => setTypeId(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
              {availableTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({UNIT_LABEL[t.unit] || t.unit})</option>
              ))}
            </select>
            {availableTypes.length === 0 && (
              <p className="text-xs text-rose-600 mt-1">利用可能な賃率種別がありません。先に <a className="underline" href="/settings/wage-types">/settings/wage-types</a> で追加してください。</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">金額 (円)</label>
            <input name="amount" type="number" min={0} step={50} required defaultValue={selected?.defaultAmount ?? ""} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            {selected?.defaultAmount && <p className="text-[10px] text-slate-400 mt-0.5">既定額: ¥{Number(selected.defaultAmount).toLocaleString()}</p>}
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">適用開始日</label>
            <input name="effectiveFrom" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
            <p className="text-[10px] text-slate-400 mt-0.5">既存の同種別の賃率があれば自動的に終了されます (履歴は残ります)</p>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">備考 (任意)</label>
            <input name="notes" placeholder="例: 主任手当込み" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
          </div>
          {err && <div className="bg-rose-50 text-rose-700 text-xs p-2 rounded">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">キャンセル</button>
            <button type="submit" disabled={pending || availableTypes.length === 0} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm disabled:opacity-60">
              {pending ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
