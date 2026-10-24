const MAX_PRODUCTS = 500;
const MAX_CATALOG_BYTES = 2_000_000;

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

  const ids = new Set();
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
      ids.has(id) ||
      !name ||
      name.length > 180 ||
      !category ||
      category.length > 80 ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 10_000_000 ||
      !link
    ) {
      throw new Error("Confira ID, nome, categoria, preço e link do produto; IDs não podem se repetir.");
    }
    ids.add(id);

    const images = Array.isArray(product.g) ? product.g : [];
    if (images.length > 50) {
      throw new Error("Cada produto pode ter no máximo 50 fotos.");
    }
    const gallery = images.map(safeImageUrl).filter(Boolean);
    const cover = safeImageUrl(product.i) || gallery[0] || "";
    const rawSizes = Array.isArray(product.sizes)
      ? product.sizes
      : typeof product.sizes === "string"
        ? product.sizes.split(/[,;|]/)
        : [];
    const sizes = [...new Set(rawSizes
      .filter((size) => typeof size === "string")
      .map((size) => size.trim())
      .filter(Boolean))].slice(0, 50);
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
      sizes,
      available: product.available !== false,
    };
  });

  if (Buffer.byteLength(JSON.stringify(products), "utf8") > MAX_CATALOG_BYTES) {
    throw new Error("O catálogo excede o limite de armazenamento permitido.");
  }
  return products;
}

function productToRow(product) {
  return {
    id: product.id,
    name: product.n,
    description: product.d,
    price: product.p,
    category: product.c,
    affiliate_url: product.l,
    emoji: product.e,
    image_url: product.i,
    image_urls: product.g,
    sizes: product.sizes,
    available: product.available,
  };
}

function rowToProduct(row) {
  return {
    id: Number(row.id),
    n: row.name,
    d: row.description || "",
    p: Number(row.price),
    c: row.category,
    l: row.affiliate_url,
    e: row.emoji || "🛍️",
    i: row.image_url || "",
    g: Array.isArray(row.image_urls) ? row.image_urls : [],
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    available: row.available !== false,
  };
}

async function listProducts(client) {
  const { data, error } = await client.from("products")
    .select("id,name,description,price,category,affiliate_url,emoji,image_url,image_urls,sizes,available")
    .order("id", { ascending: true });
  if (error) throw error;
  return (data || []).map(rowToProduct);
}

async function replaceProducts(client, products) {
  const { error } = await client.rpc("replace_4kings_products", {
    payload: products.map(productToRow),
  });
  if (error) throw error;
}

module.exports = {
  MAX_CATALOG_BYTES,
  MAX_PRODUCTS,
  listProducts,
  productToRow,
  replaceProducts,
  rowToProduct,
  safeAffiliateUrl,
  safeImageUrl,
  validateProducts,
};
