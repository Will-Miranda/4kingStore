const { readJsonBody, requireAdmin, sameOrigin, sendJson } = require("../../lib/api");
const { MAX_PRODUCTS, listProducts, replaceProducts } = require("../../lib/products");
const { parseProductsWorkbook } = require("../../lib/excel");
const { getSupabaseClient, supabaseConfigurationError } = require("../../lib/supabase");

function duplicateKey(product) {
  return `${product.n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()}|${product.c.toLowerCase()}`;
}

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

  let products;
  try {
    const { file } = readJsonBody(req);
    if (typeof file !== "string" || file.length > 4_000_100) {
      return sendJson(res, 413, { error: "A planilha excede o limite permitido." });
    }
    const match = /^data:application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet;base64,([A-Za-z0-9+/]+={0,2})$/.exec(file);
    if (!match) return sendJson(res, 400, { error: "Envie um arquivo XLSX válido." });
    products = await parseProductsWorkbook(Buffer.from(match[1], "base64"));
    if (!products.length) return sendJson(res, 400, { error: "A planilha não contém produtos." });
    const importedIds = new Set();
    const importedLinks = new Set();
    const importedNames = new Set();
    for (const product of products) {
      const id = String(product.id);
      const link = product.l.toLowerCase();
      const name = duplicateKey(product);
      if (importedIds.has(id) || importedLinks.has(link) || importedNames.has(name)) {
        return sendJson(res, 409, { error: `Produto duplicado na planilha: ${product.n}.` });
      }
      importedIds.add(id);
      importedLinks.add(link);
      importedNames.add(name);
    }
  } catch (error) {
    return sendJson(res, 400, { error: error.message || "Não foi possível validar a planilha." });
  }

  try {
    const client = getSupabaseClient();
    const current = await listProducts(client);
    if (current.length + products.length > MAX_PRODUCTS) {
      return sendJson(res, 400, { error: `O catálogo não pode ultrapassar ${MAX_PRODUCTS} produtos.` });
    }
    const currentIds = new Set(current.map((product) => String(product.id)));
    const currentLinks = new Set(current.map((product) => product.l.toLowerCase()));
    const currentNames = new Set(current.map(duplicateKey));
    const duplicate = products.find((product) =>
      currentIds.has(String(product.id)) ||
      currentLinks.has(product.l.toLowerCase()) ||
      currentNames.has(duplicateKey(product))
    );
    if (duplicate) {
      return sendJson(res, 409, { error: `Produto já cadastrado: ${duplicate.n}.` });
    }
    await replaceProducts(client, [...current, ...products]);
    return sendJson(res, 200, { imported: products.length });
  } catch (error) {
    console.error("Falha ao importar produtos para o Supabase.", error);
    return sendJson(res, 502, { error: "Não foi possível importar os produtos." });
  }
};
