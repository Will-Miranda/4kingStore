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

test("cart checkout opens the selected product link directly", () => {
  assert.match(
    html,
    /const p=cart\.find\(x=>x\.id===sel\),url=Storefront\.purchaseUrl\(p\);[\s\S]*?window\.open\(url,"_blank","noopener,noreferrer"\)/,
  );
});
