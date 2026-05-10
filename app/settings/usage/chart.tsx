"use client";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export default function UsageChart({ data }: { data: { day: string; cost: number }[] }) {
  if (data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v.toFixed(3)}`} />
        <Tooltip formatter={(v: any) => `$${Number(v).toFixed(4)}`} labelFormatter={(l) => `日付: ${l}`} />
        <Line type="monotone" dataKey="cost" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="コスト (USD)" />
      </LineChart>
    </ResponsiveContainer>
  );
}
