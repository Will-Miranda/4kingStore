const { listProducts } = require("../../lib/products");
const { requireAdmin, sendJson } = require("../../lib/api");
const { createProductsWorkbook } = require("../../lib/excel");
const { getSupabaseClient, supabaseConfigurationError } = require("../../lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Método não permitido." });
  }
  if (!requireAdmin(req, res)) return;
  const configError = supabaseConfigurationError();
  if (configError) return sendJson(res, 503, { error: configError });

  try {
    const products = await listProducts(getSupabaseClient());
    const workbook = await createProductsWorkbook(products);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="4kings-produtos.xlsx"');
    res.setHeader("Cache-Control", "no-store");
    return res.end(workbook);
  } catch (error) {
    console.error("Falha ao exportar os produtos para XLSX.", error);
    return sendJson(res, 502, { error: "Não foi possível exportar os produtos." });
  }
};
