const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");

const { productToRow, rowToProduct, validateProducts } = require("../lib/products");
const { createProductsWorkbook, parseProductsWorkbook } = require("../lib/excel");

const product = {
  id: 101,
  n: "Camisa de teste",
  d: "Descrição da camisa",
  p: 89.9,
  c: "Camisas",
  l: "https://br.shein.com/item/101",
  e: "👔",
  i: "https://images.example.test/camisa.jpg",
  g: ["https://images.example.test/camisa.jpg"],
  sizes: ["M", "G"],
  available: true,
};

test("product validation normalizes sizes, images, and availability", () => {
  const [normalized] = validateProducts([{ ...product, sizes: [" M ", "M", "G"], available: false }]);

  assert.deepEqual(normalized.sizes, ["M", "G"]);
  assert.equal(normalized.available, false);
  assert.equal(normalized.i, product.i);
  assert.throws(() => validateProducts([{ ...product, id: 1 }, { ...product, id: 1 }]), /IDs não podem se repetir/);
});

test("Supabase row mapping preserves the public product shape", () => {
  assert.deepEqual(rowToProduct(productToRow(product)), product);
});

test("XLSX export and validated import preserve product data and image URLs", async () => {
  const workbook = await createProductsWorkbook([product]);
  const imported = await parseProductsWorkbook(workbook);

  assert.deepEqual(imported, [product]);
});

test("XLSX import rejects formulas in product rows", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Produtos");
  sheet.addRow(["ID", "Nome", "Descrição", "Preço", "Categoria", "Tamanhos", "Disponibilidade", "URLs das imagens", "Link Shein", "Emoji"]);
  sheet.addRow([101, "Camisa", { formula: "1+1" }, 89.9, "Camisas", "M", "Sim", "", "https://br.shein.com/item/101", "👔"]);

  await assert.rejects(parseProductsWorkbook(Buffer.from(await workbook.xlsx.writeBuffer())), /não pode conter fórmulas/);
});
