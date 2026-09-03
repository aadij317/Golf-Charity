"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "./actions";

export default function ProfileForm({
  userId,
  fullName,
  role,
}: {
  userId: string;
  fullName: string | null;
  role: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(formData: FormData) {
    setSaved(false);
    startTransition(async () => {
      const res = await updateProfile(userId, formData);
      if (res.error) setError(res.error);
      else {
        setError(null);
        setSaved(true);
      }
    });
  }

  return (
    <form action={handleSubmit} className="panel space-y-4 p-5">
      <h2 className="font-display text-lg italic text-ink">Profile</h2>

      <div>
        <label className="mb-1 block text-xs text-ink/60">Full name</label>
        <input name="full_name" defaultValue={fullName ?? ""} className="input w-full" />
      </div>

      <div>
        <label className="mb-1 block text-xs text-ink/60">Role</label>
        <select name="role" defaultValue={role} className="input w-full">
          <option value="subscriber">Subscriber</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {error && <p className="text-sm text-flag">{error}</p>}
      {saved && !error && <p className="text-sm text-fairway">Saved.</p>}

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
