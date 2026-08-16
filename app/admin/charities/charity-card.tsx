"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { deleteCharity, toggleFeatured } from "./actions";
import CharityForm from "./charity-form";

type Charity = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  is_featured: boolean;
};

export default function CharityCard({ charity }: { charity: Charity }) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleToggleFeatured() {
    startTransition(async () => {
      await toggleFeatured(charity.id, !charity.is_featured);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteCharity(charity.id);
    });
  }

  if (editing) {
    return (
      <div className="panel p-5">
        <CharityForm charity={charity} onDone={() => setEditing(false)} />
        <button
          onClick={() => setEditing(false)}
          className="mt-2 text-xs text-paper/50 underline underline-offset-2"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="relative h-32 bg-ink-line">
        {charity.image_url ? (
          <Image
            src={charity.image_url}
            alt=""
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-paper/30">
            No image
          </div>
        )}
        {charity.is_featured && <span className="stamp-sand absolute right-2 top-2">Featured</span>}
      </div>

      <div className="space-y-2 p-4">
        <h3 className="font-display text-lg italic text-paper">{charity.name}</h3>
        <p className="line-clamp-2 text-sm text-paper/60">{charity.description || "—"}</p>

        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
          <button onClick={() => setEditing(true)} className="text-sand underline underline-offset-2">
            Edit
          </button>
          <button onClick={handleToggleFeatured} disabled={isPending} className="text-sand underline underline-offset-2">
            {charity.is_featured ? "Unfeature" : "Feature"}
          </button>
          {confirmingDelete ? (
            <span className="flex items-center gap-2">
              <span className="text-paper/50">Delete?</span>
              <button onClick={handleDelete} disabled={isPending} className="text-flag-soft underline underline-offset-2">
                Confirm
              </button>
              <button onClick={() => setConfirmingDelete(false)} className="text-paper/50 underline underline-offset-2">
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-flag-soft underline underline-offset-2"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
