(function (root, factory) {
  const storefront = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = storefront;
  } else {
    root.Storefront = storefront;
  }
})(globalThis, function () {
  function purchaseUrl(product) {
    if (!product || typeof product.l !== "string") return null;
    try {
      const url = new URL(product.l);
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  }

  return { purchaseUrl };
});
