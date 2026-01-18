import { supabase } from "../lib/supabaseClient";

export const getPublicImageUrl = (
  filePath,
  bucketName = "breast-cancer-images"
) => {
  if (!filePath) return "";

  if (filePath.startsWith("http")) return filePath;

  const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);

  return data.publicUrl;
};
