const { readFile } = require("node:fs/promises");
const { join } = require("node:path");
const { validateProducts, replaceProducts } = require("../lib/products");
const { getSupabaseClient } = require("../lib/supabase");

async function main() {
  const html = await readFile(join(__dirname, "..", "index.html"), "utf8");
  const match = html.match(/<script id="state" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("Não foi possível localizar o catálogo embutido.");
  const embedded = JSON.parse(match[1]);
  const products = validateProducts(embedded.prods);
  const client = getSupabaseClient();
  const { data, error } = await client.from("products").select("id").limit(1);
  if (error) throw error;
  if (data.length) {
    throw new Error("A tabela products já contém dados; a carga inicial foi cancelada para evitar sobrescrevê-los.");
  }
  await replaceProducts(client, products);
  console.log(`${products.length} produtos embutidos foram importados. URLs de imagem antigas sem HTTPS foram ignoradas.`);
}

main().catch((error) => {
  console.error("Falha na carga inicial do catálogo.", error);
  process.exitCode = 1;
});
