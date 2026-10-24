const { list, put } = require("@vercel/blob");
const { readJsonBody, requireAdmin, sameOrigin, sendJson } = require("../lib/api");

const CATALOG_PATH = "4kings-store/catalog.json";
const MAX_PRODUCTS = 500;
const MAX_CATALOG_BYTES = 2_000_000;

function blobIsConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function safeImageUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function safeAffiliateUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return "";
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function validateProducts(value) {
  if (!Array.isArray(value) || value.length > MAX_PRODUCTS) {
    throw new Error(`O catálogo deve conter no máximo ${MAX_PRODUCTS} produtos.`);
  }

  const products = value.map((product) => {
    if (!product || typeof product !== "object" || Array.isArray(product)) {
      throw new Error("Um produto do catálogo está inválido.");
    }
    const id = Number(product.id);
    const price = Number(product.p);
    const name = typeof product.n === "string" ? product.n.trim() : "";
    const category = typeof product.c === "string" ? product.c.trim() : "";
    const link = safeAffiliateUrl(product.l);
    if (
      !Number.isSafeInteger(id) ||
      !name ||
      name.length > 180 ||
      !category ||
      category.length > 80 ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 10_000_000 ||
      !link
    ) {
      throw new Error("Confira nome, categoria, preço e link do produto.");
    }

    const images = Array.isArray(product.g) ? product.g : [];
    if (images.length > 50) {
      throw new Error("Cada produto pode ter no máximo 50 fotos.");
    }
    const gallery = images.map(safeImageUrl).filter(Boolean);
    const cover = safeImageUrl(product.i) || gallery[0] || "";
    return {
      id,
      n: name,
      p: price,
      c: category,
      l: link,
      d: typeof product.d === "string" ? product.d.slice(0, 2000) : "",
      e: typeof product.e === "string" ? product.e.slice(0, 20) : "🛍️",
      i: cover,
      g: gallery,
    };
  });

  if (Buffer.byteLength(JSON.stringify(products), "utf8") > MAX_CATALOG_BYTES) {
    throw new Error("O catálogo excede o limite de armazenamento permitido.");
  }
  return products;
}

async function findCatalog() {
  const result = await list({ prefix: CATALOG_PATH, limit: 100 });
  return result.blobs.find((blob) => blob.pathname === CATALOG_PATH) || null;
}

module.exports = async function handler(req, res) {
  if (!["GET", "PUT"].includes(req.method)) {
    res.setHeader("Allow", "GET, PUT");
    return sendJson(res, 405, { error: "Método não permitido." });
  }
  if (!blobIsConfigured()) {
    return sendJson(res, 503, { error: "Configure BLOB_READ_WRITE_TOKEN na Vercel." });
  }

  if (req.method === "GET") {
    try {
      const blob = await findCatalog();
      if (!blob) return sendJson(res, 200, { products: null });
      const response = await fetch(blob.url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Blob respondeu HTTP ${response.status}.`);
      const stored = await response.json();
      return sendJson(res, 200, {
        products: validateProducts(stored.products),
        updatedAt: stored.updatedAt || null,
      });
    } catch (error) {
      console.error("Falha ao carregar o catálogo do Blob.", error);
      return sendJson(res, 502, { error: "Não foi possível carregar o catálogo na nuvem." });
    }
  }

  if (!sameOrigin(req)) {
    return sendJson(res, 403, { error: "Origem da solicitação não autorizada." });
  }
  if (!requireAdmin(req, res)) return;
  let products;
  try {
    products = validateProducts(readJsonBody(req).products);
  } catch (error) {
    return sendJson(res, 400, { error: error.message || "Catálogo inválido." });
  }

  try {
    await put(
      CATALOG_PATH,
      JSON.stringify({ products, updatedAt: new Date().toISOString() }),
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: "application/json; charset=utf-8",
      },
    );
    return sendJson(res, 200, { saved: true, count: products.length });
  } catch (error) {
    console.error("Falha ao salvar o catálogo no Blob.", error);
    return sendJson(res, 502, { error: "Não foi possível salvar o catálogo na nuvem." });
  }
};
