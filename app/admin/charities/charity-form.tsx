"use client";

import { useState, useTransition } from "react";
import { createCharity, updateCharity } from "./actions";

type Charity = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_featured: boolean;
};

export default function CharityForm({
  charity,
  onDone,
}: {
  charity?: Charity;
  onDone?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = charity
        ? await updateCharity(charity.id, formData)
        : await createCharity(formData);
      if (res.error) setError(res.error);
      else onDone?.();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-ink/60">Name</label>
        <input name="name" defaultValue={charity?.name} required className="input w-full" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink/60">Description</label>
        <textarea
          name="description"
          defaultValue={charity?.description ?? ""}
          rows={3}
          className="input w-full"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-ink/60">
          Image {charity?.image_url && "(leave blank to keep current)"}
        </label>
        <input name="image" type="file" accept="image/*" className="input w-full" />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink/80">
        <input
          type="checkbox"
          name="is_featured"
          defaultChecked={charity?.is_featured}
          className="h-4 w-4"
        />
        Featured on homepage
      </label>

      {error && <p className="text-sm text-flag">{error}</p>}

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Saving…" : charity ? "Save changes" : "Add charity"}
      </button>
    </form>
  );
}
