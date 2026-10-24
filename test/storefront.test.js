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
  assert.match(html, /href="\$\{esc\(url\)\}" target="_blank" rel="noopener sponsored"(?:\$\{filler\?' tabindex="-1"':""\})?>Comprar agora/);
  assert.match(html, /id="pdBuy" target="_blank" rel="noopener sponsored">Comprar agora/);
  assert.match(html, /const url=Storefront\.purchaseUrl\(p\),buy=\$\("#pdBuy"\)/);
  assert.doesNotMatch(html, /id="(?:mReg|mProf|mConf|pgCrm|userBtn|crmBtn)"/);
});

test("storefront has no cart and product cards expose only direct purchase", () => {
  assert.doesNotMatch(html, /cartBtn|mCart|cartList|checkout|Carrinho|Adicionar ao carrinho|data-a=/i);
  assert.doesNotMatch(html, /<button[^>]*>Adicionar<\/button>/i);
  assert.match(html, /\$\{url&&available\?`<a class="btn" href="\$\{esc\(url\)\}" target="_blank" rel="noopener sponsored"\$\{filler\?' tabindex="-1"':""\}>Comprar agora/);
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

test("catalog displays eight products at a time with a centered load-more divider", () => {
  assert.match(html, /id="loadMore" hidden/);
  assert.match(html, /id="loadMoreButton" type="button">Ver mais<\/button>/);
  assert.match(html, /visibleProducts=8/);
  assert.match(html, /categoryProducts\.slice\(0,visibleProducts\)/);
  assert.match(html, /\$\(\"\#loadMore\"\)\.hidden=visibleList\.length>=categoryProducts\.length/);
  assert.match(html, /visibleProducts\+=8;catalogResetArmed=false;render\(\)/);
  assert.match(html, /cat=b\.dataset\.c;if\(cat==="Todos"\)visibleCategories=4;visibleProducts=8;catalogResetArmed=false;render\(\)/);
  assert.match(html, /\.load-more::before,\.load-more::after/);
  assert.match(html, /@media\(max-width:700px\)\{\.grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
});

test("catalog resets to eight products after reaching the end and returning to the page top", () => {
  assert.match(html, /catalogResetArmed=false,lastCatalogScrollY=window\.scrollY/);
  assert.match(html, /scrollY>lastCatalogScrollY&&allProductsShown&&scrollY\+window\.innerHeight>=gridBottom-1/);
  assert.match(html, /if\(catalogResetArmed&&scrollY<=1\)\{[\s\S]*?resetProducts=visibleProducts>8,resetCategories=visibleCategories>4/);
  assert.match(html, /if\(resetProducts\)visibleProducts=8/);
  assert.match(html, /if\(resetCategories\)visibleCategories=4/);
  assert.match(html, /if\(resetProducts\|\|resetCategories\)render\(\)/);
  assert.match(html, /visibleProducts\+=8;catalogResetArmed=false;render\(\)/);
});

test("categories reset after reaching the catalog end while keeping the selected category visible", () => {
  assert.match(html, /visibleCategories=4/);
  assert.match(html, /if\(cat!=="Todos"&&!shownCats\.includes\(cat\)\)\{shownCats\[shownCats\.length-1\]=cat\}/);
  assert.match(html, /visibleCategories=Math\.min\(cats\.length,visibleCategories\+4\);render\(\)/);
});

test("catalog fills the final responsive grid row only after loading all products", () => {
  assert.match(html, /gridColumns=getComputedStyle\(\$\("#grid"\)\)\.gridTemplateColumns\.split\(\/\\s\+\/\)\.filter\(Boolean\)\.length\|\|1/);
  assert.match(html, /visibleProducts>8&&categoryProducts\.length===visibleList\.length&&visibleList\.length>0/);
  assert.match(html, /\(gridColumns-visibleList\.length%gridColumns\)%gridColumns/);
  assert.match(html, /gridProducts=fillCount\?\[\.\.\.visibleList,\.\.\.Array\.from\(\{length:fillCount\},\(\)=>categoryProducts\[0\]\)\]:visibleList/);
  assert.match(html, /renderedGridColumns=gridColumns/);
  assert.match(html, /nextGridColumns===renderedGridColumns/);
  assert.match(html, /data-grid-filler="true" aria-hidden="true"/);
  assert.match(html, /\$\(\"\#loadMore\"\)\.hidden=visibleList\.length>=categoryProducts\.length/);
});

test("category row expands four categories at a time and resets when Todos is selected", () => {
  assert.match(html, /visibleCategories=4/);
  assert.match(html, /cats\.slice\(0,visibleCategories\)/);
  assert.match(html, /class="category-more" id="categoryMore" type="button" aria-label="Mostrar mais categorias"/);
  assert.match(html, /visibleCategories=Math\.min\(cats\.length,visibleCategories\+4\);render\(\)/);
  assert.match(html, /if\(cat==="Todos"\)visibleCategories=4/);
  assert.match(html, /\.tabs \.category-more\{display:block/);
  assert.match(html, /if\(cat!=="Todos"&&!shownCats\.includes\(cat\)\)\{shownCats\[shownCats\.length-1\]=cat\}/);
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
