const { randomUUID } = require("node:crypto");
const { readJsonBody, requireAdmin, sameOrigin, sendJson } = require("../lib/api");
const { getStorageBucket, getSupabaseClient, supabaseConfigurationError } = require("../lib/supabase");

const MAX_IMAGE_BYTES = 2_000_000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Método não permitido." });
  }
  if (!sameOrigin(req)) {
    return sendJson(res, 403, { error: "Origem da solicitação não autorizada." });
  }
  if (!requireAdmin(req, res)) return;
  const configError = supabaseConfigurationError();
  if (configError) return sendJson(res, 503, { error: configError });

  let image;
  try {
    image = readJsonBody(req).image;
  } catch {
    return sendJson(res, 400, { error: "Arquivo de imagem inválido." });
  }
  if (typeof image !== "string" || image.length > 2_800_000) {
    return sendJson(res, 413, { error: "A imagem excede o limite de 2 MB." });
  }
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match) {
    return sendJson(res, 400, { error: "Envie uma imagem JPEG válida." });
  }
  const bytes = Buffer.from(match[1], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    return sendJson(res, 413, { error: "A imagem excede o limite de 2 MB." });
  }

  try {
    const client = getSupabaseClient();
    const path = `products/${randomUUID()}.jpg`;
    const { error } = await client.storage.from(getStorageBucket()).upload(path, bytes, {
      cacheControl: "31536000",
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) throw error;
    const { data } = client.storage.from(getStorageBucket()).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Supabase não retornou uma URL pública da imagem.");
    return sendJson(res, 201, { url: data.publicUrl });
  } catch (error) {
    console.error("Falha ao enviar imagem para o Supabase Storage.", error);
    return sendJson(res, 502, { error: "Não foi possível armazenar a imagem permanentemente." });
  }
};
