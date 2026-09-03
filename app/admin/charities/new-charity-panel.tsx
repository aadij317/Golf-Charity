"use client";

import { useState } from "react";
import CharityForm from "./charity-form";

export default function NewCharityPanel() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        + Add charity
      </button>
    );
  }

  return (
    <div className="panel mb-6 max-w-md p-5">
      <h2 className="mb-3 font-display text-lg italic text-ink">New charity</h2>
      <CharityForm onDone={() => setOpen(false)} />
      <button onClick={() => setOpen(false)} className="mt-2 text-xs text-ink/50 underline underline-offset-2">
        Cancel
      </button>
    </div>
  );
}
