import { supabase } from "../utility/supabaseClient";

const BUCKET = "expenses";

const extractPathFromPublicUrl = (url: string): string | null => {
  try {
    const marker = `/object/public/${BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
  } catch {
    return null;
  }
};

/**
 * Uploads a file to the expenses bucket and returns the public URL and file path.
 */
export const uploadExpensePhoto = async (
  file: File
): Promise<{ publicUrl: string; path: string }> => {
  const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
  const unique = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
  const filePath = `photos/${unique}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, {
    upsert: false,
    cacheControl: "3600",
  });
  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  const publicUrl = data.publicUrl;
  return { publicUrl, path: filePath };
};

/**
 * Deletes a file in the expenses bucket given its public URL.
 * No-ops if URL cannot be parsed into a storage path.
 */
export const deleteExpensePhotoByUrl = async (publicUrl?: string | null): Promise<void> => {
  if (!publicUrl) return;
  const path = extractPathFromPublicUrl(publicUrl);
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    // Swallow errors to avoid blocking main flows; could be logged if needed
    // console.error("Failed to delete from storage:", error);
  }
};
