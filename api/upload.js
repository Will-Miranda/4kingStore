const { put } = require("@vercel/blob");
const { readJsonBody, requireAdmin, sameOrigin, sendJson } = require("../lib/api");
const { randomUUID } = require("node:crypto");

const MAX_IMAGE_BYTES = 2_000_000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Método não permitido." });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return sendJson(res, 503, { error: "Configure BLOB_READ_WRITE_TOKEN na Vercel." });
  }
  if (!sameOrigin(req)) {
    return sendJson(res, 403, { error: "Origem da solicitação não autorizada." });
  }
  if (!requireAdmin(req, res)) return;

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
    const blob = await put(
      `4kings-store/products/${randomUUID()}.jpg`,
      bytes,
      {
        access: "public",
        addRandomSuffix: true,
        contentType: "image/jpeg",
      },
    );
    return sendJson(res, 201, { url: blob.url });
  } catch (error) {
    console.error("Falha ao enviar imagem para o Blob.", error);
    return sendJson(res, 502, { error: "Não foi possível armazenar a imagem na nuvem." });
  }
};
