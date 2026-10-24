const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const { purchaseUrl } = require("../storefront");
const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");

test("purchase URLs allow only absolute HTTP and HTTPS links", () => {
  assert.equal(
    purchaseUrl({ l: "https://br.shein.com/product?ref=4kings" }),
    "https://br.shein.com/product?ref=4kings",
  );
  assert.equal(purchaseUrl({ l: "http://br.shein.com/product" }), "http://br.shein.com/product");
  assert.equal(purchaseUrl({ l: "javascript:alert(1)" }), null);
  assert.equal(purchaseUrl({ l: "/product/123" }), null);
  assert.equal(purchaseUrl({}), null);
  assert.equal(purchaseUrl(null), null);
});

test("product cards and details link directly to the product without a customer account", () => {
  assert.match(html, /Storefront\.purchaseUrl\(p\)/);
  assert.match(html, /href="\$\{esc\(url\)\}" target="_blank" rel="noopener sponsored">Comprar agora/);
  assert.match(html, /id="pdBuy" target="_blank" rel="noopener sponsored">Comprar agora/);
  assert.match(html, /const url=Storefront\.purchaseUrl\(p\),buy=\$\("#pdBuy"\)/);
  assert.doesNotMatch(html, /id="(?:mReg|mProf|mConf|pgCrm|userBtn|crmBtn)"/);
});

test("storefront has no cart and product cards expose only direct purchase", () => {
  assert.doesNotMatch(html, /cartBtn|mCart|cartList|checkout|Carrinho|Adicionar ao carrinho|data-a=/i);
  assert.doesNotMatch(html, /<button[^>]*>Adicionar<\/button>/i);
  assert.match(html, /<div class="row">\$\{url&&available\?`<a class="btn" href="\$\{esc\(url\)\}" target="_blank" rel="noopener sponsored">Comprar agora/);
  assert.doesNotMatch(html, /localStorage|legacyProducts|legacyMigration/);
});

test("storefront provides a mobile menu and product availability fields", () => {
  assert.match(html, /aria-controls="mobileNav"/);
  assert.match(html, /data-menu-action="categories"/);
  assert.match(html, /data-menu-action="products"/);
  assert.match(html, /id="psizes"/);
  assert.match(html, /id="pavailable"/);
  assert.match(html, /available=p\.available!==false/);
});

test("admin product database exposes XLSX import and export", () => {
  assert.match(html, /\/api\/products\/export/);
  assert.match(html, /\/api\/products\/import/);
  assert.match(html, /Importar produtos \(\.xlsx\)/);
  assert.match(html, /Exportar produtos para Excel \(\.xlsx\)/);
});

test("admin panel requires eight consecutive logo clicks and retains backend login", () => {
  assert.match(
    html,
    /tm=setTimeout\(\(\)=>clicks=0,1500\);if\(clicks<8\)return/,
  );
  assert.match(html, /apiRequest\("\/api\/admin\/login"/);
  assert.match(html, /apiRequest\("\/api\/admin\/session"/);
});
