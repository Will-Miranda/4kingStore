const { readJsonBody, requireAdmin, sameOrigin, sendJson } = require("../lib/api");
const { listProducts, replaceProducts, validateProducts } = require("../lib/products");
const { getSupabaseClient, supabaseConfigurationError } = require("../lib/supabase");

module.exports = async function handler(req, res) {
  if (!["GET", "PUT"].includes(req.method)) {
    res.setHeader("Allow", "GET, PUT");
    return sendJson(res, 405, { error: "Método não permitido." });
  }

  if (req.method === "PUT") {
    if (!sameOrigin(req)) {
      return sendJson(res, 403, { error: "Origem da solicitação não autorizada." });
    }
    if (!requireAdmin(req, res)) return;
  }

  const configError = supabaseConfigurationError();
  if (configError) return sendJson(res, 503, { error: configError });

  let products;
  if (req.method === "PUT") {
    try {
      products = validateProducts(readJsonBody(req).products);
    } catch (error) {
      return sendJson(res, 400, { error: error.message || "Catálogo inválido." });
    }
  }

  try {
    const client = getSupabaseClient();
    if (req.method === "GET") {
      const storedProducts = await listProducts(client);
      return sendJson(res, 200, { products: storedProducts });
    }
    await replaceProducts(client, products);
    return sendJson(res, 200, { saved: true, count: products.length });
  } catch (error) {
    console.error("Falha ao acessar o catálogo do Supabase.", error);
    return sendJson(res, 502, { error: "Não foi possível acessar o catálogo persistente." });
  }
};
