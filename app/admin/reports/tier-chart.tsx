"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function TierChart({ data }: { data: { tier: string; winners: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid stroke="#2A3439" vertical={false} />
        <XAxis dataKey="tier" stroke="#F6F3EC" tick={{ fill: "#F6F3EC99", fontSize: 12 }} axisLine={{ stroke: "#2A3439" }} tickLine={false} />
        <YAxis allowDecimals={false} stroke="#F6F3EC" tick={{ fill: "#F6F3EC99", fontSize: 12 }} axisLine={{ stroke: "#2A3439" }} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1B2327", border: "1px solid #2A3439", borderRadius: 3, fontSize: 12 }}
          labelStyle={{ color: "#F6F3EC" }}
          cursor={{ fill: "#F6F3EC0A" }}
        />
        <Bar dataKey="winners" fill="#C9A46A" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
