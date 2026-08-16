"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

const BUCKET = "charity-images";

async function maybeUploadImage(
  supabase: ReturnType<typeof createClient>,
  file: File | null
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const ext = file.name.split(".").pop();
  const path = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createCharity(formData: FormData) {
  await requireAdmin();
  const supabase = createClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const is_featured = formData.get("is_featured") === "on";
  const file = formData.get("image") as File | null;

  if (!name) return { error: "Charity name is required." };

  let image_url: string | null = null;
  try {
    image_url = await maybeUploadImage(supabase, file);
  } catch (e: any) {
    return { error: e.message };
  }

  const { error } = await supabase.from("charities").insert({
    name,
    description,
    is_featured,
    image_url,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin/charities");
  return { error: null };
}

export async function updateCharity(charityId: string, formData: FormData) {
  await requireAdmin();
  const supabase = createClient();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const is_featured = formData.get("is_featured") === "on";
  const file = formData.get("image") as File | null;

  if (!name) return { error: "Charity name is required." };

  const update: Record<string, unknown> = { name, description, is_featured };

  try {
    const image_url = await maybeUploadImage(supabase, file);
    if (image_url) update.image_url = image_url;
  } catch (e: any) {
    return { error: e.message };
  }

  const { error } = await supabase.from("charities").update(update).eq("id", charityId);
  if (error) return { error: error.message };
  revalidatePath("/admin/charities");
  return { error: null };
}

export async function deleteCharity(charityId: string) {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase.from("charities").delete().eq("id", charityId);
  if (error) return { error: error.message };
  revalidatePath("/admin/charities");
  return { error: null };
}

export async function toggleFeatured(charityId: string, next: boolean) {
  await requireAdmin();
  const supabase = createClient();
  const { error } = await supabase
    .from("charities")
    .update({ is_featured: next })
    .eq("id", charityId);
  if (error) return { error: error.message };
  revalidatePath("/admin/charities");
  return { error: null };
}
