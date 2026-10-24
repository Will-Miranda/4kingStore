const ExcelJS = require("exceljs");
const { validateProducts } = require("./products");

const EXPORT_COLUMNS = [
  "ID",
  "Nome",
  "Descrição",
  "Preço",
  "Categoria",
  "Tamanhos",
  "Disponibilidade",
  "URLs das imagens",
  "Link Shein",
  "Emoji",
];
const MAX_WORKBOOK_BYTES = 3_000_000;

function exportRow(product) {
  return [
    product.id,
    product.n,
    product.d || "",
    product.p,
    product.c,
    (product.sizes || []).join(", "),
    product.available === false ? "Não" : "Sim",
    (product.g || []).join("\n"),
    product.l,
    product.e || "🛍️",
  ];
}

async function createProductsWorkbook(products) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "4 Kings Store";
  const sheet = workbook.addWorksheet("Produtos");
  sheet.addRow(EXPORT_COLUMNS);
  for (const product of products) sheet.addRow(exportRow(product));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns = EXPORT_COLUMNS.map((header, index) => ({
    header,
    key: String(index),
    width: [14, 34, 48, 14, 24, 24, 18, 60, 52, 12][index],
  }));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function normalizeHeader(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellValue(cell) {
  const value = cell.value;
  if (value && typeof value === "object" && ("formula" in value || "sharedFormula" in value)) {
    throw new Error("A planilha não pode conter fórmulas nas linhas de produtos.");
  }
  if (value && typeof value === "object" && "text" in value) return value.text;
  return value;
}

function parseSizes(value) {
  if (typeof value !== "string") value = String(value ?? "");
  return value.split(/[,;|\n]/).map((size) => size.trim()).filter(Boolean);
}

function parseAvailable(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["sim", "s", "true", "1", "disponivel", "disponível"].includes(normalized)) return true;
  if (["nao", "não", "n", "false", "0", "indisponivel", "indisponível"].includes(normalized)) {
    return false;
  }
  throw new Error("Disponibilidade deve ser Sim ou Não.");
}

async function parseProductsWorkbook(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_WORKBOOK_BYTES) {
    throw new Error("A planilha está vazia ou excede o limite de 3 MB.");
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new Error("O arquivo não é uma planilha XLSX válida.");
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2 || sheet.rowCount > 501) {
    throw new Error("A planilha precisa ter cabeçalho e até 500 produtos.");
  }

  const headerIndexes = new Map();
  sheet.getRow(1).eachCell((cell, column) => {
    headerIndexes.set(normalizeHeader(cellValue(cell)), column);
  });
  const column = (name) => headerIndexes.get(normalizeHeader(name));
  const required = ["ID", "Nome", "Descrição", "Preço", "Categoria", "Tamanhos", "Disponibilidade", "URLs das imagens", "Link Shein"];
  if (required.some((header) => !column(header))) {
    throw new Error("A planilha deve conter as colunas exportadas: ID, Nome, Descrição, Preço, Categoria, Tamanhos, Disponibilidade, URLs das imagens e Link Shein.");
  }

  const products = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (header) => {
      const index = column(header);
      return index ? cellValue(row.getCell(index)) : undefined;
    };
    if (!row.values.some((value) => value !== null && value !== undefined && value !== "")) return;
    const rawImages = String(get("URLs das imagens") ?? "");
    products.push({
      id: Number(get("ID")),
      n: String(get("Nome") ?? ""),
      d: String(get("Descrição") ?? ""),
      p: Number(get("Preço")),
      c: String(get("Categoria") ?? ""),
      sizes: parseSizes(get("Tamanhos")),
      available: parseAvailable(get("Disponibilidade")),
      g: rawImages.split(/[\n;]/).map((url) => url.trim()).filter(Boolean),
      l: String(get("Link Shein") ?? ""),
      e: String(get("Emoji") || "🛍️"),
    });
  });
  return validateProducts(products);
}

module.exports = {
  EXPORT_COLUMNS,
  MAX_WORKBOOK_BYTES,
  createProductsWorkbook,
  parseProductsWorkbook,
};
