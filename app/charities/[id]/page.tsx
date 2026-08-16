import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Individual charity profile, linked from the /charities directory.
// Matches that page's query style (public select, same columns) plus
// image_url and full description for the detail view.
export default async function CharityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: charity } = await supabase
    .from("charities")
    .select("id, name, description, image_url, is_featured")
    .eq("id", params.id)
    .maybeSingle();

  if (!charity) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link
        href="/charities"
        className="text-sm text-paper/60 underline underline-offset-2"
      >
        ← All charities
      </Link>

      <div className="panel mt-6 overflow-hidden">
        <div className="relative h-56 bg-ink-line">
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
          {charity.is_featured && (
            <span className="stamp-sand absolute right-3 top-3">Featured</span>
          )}
        </div>

        <div className="space-y-4 p-6">
          <h1 className="font-display text-2xl italic text-paper">
            {charity.name}
          </h1>
          {charity.description && (
            <p className="text-sm leading-relaxed text-paper/70">
              {charity.description}
            </p>
          )}

          <Link
            href={`/subscribe?charity=${charity.id}`}
            className="btn-primary mt-2 inline-flex"
          >
            Subscribe &amp; support this charity
          </Link>
        </div>
      </div>
    </div>
  );
}
