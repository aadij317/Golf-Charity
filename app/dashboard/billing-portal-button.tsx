"use client";

import { useState } from "react";

export default function BillingPortalButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/billing-portal", { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not open billing portal");
      window.location.href = body.url;
    } catch (portalError: any) {
      setError(portalError.message ?? "Could not open billing portal");
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={openPortal} disabled={loading} className="btn-ghost px-4 py-2 text-xs">
        {loading ? "Opening billing…" : "Manage membership"}
      </button>
      {error && <p className="mt-2 text-xs text-flag">{error}</p>}
    </div>
  );
}
