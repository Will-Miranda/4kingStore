const test = require("node:test");
const assert = require("node:assert/strict");

const { randomBytes } = require("node:crypto");

process.env.ADMIN_PASSWORD ||= randomBytes(32).toString("base64url");
process.env.ADMIN_SESSION_SECRET ||= randomBytes(48).toString("base64url");
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "token-falso-apenas-para-testes";
delete process.env.VERCEL;

const login = require("../api/admin/login");
const session = require("../api/admin/session");
const products = require("../api/products");
const exportProducts = require("../api/products/export");
const importProducts = require("../api/products/import");
const upload = require("../api/upload");
const { createProductsWorkbook } = require("../lib/excel");
const { verifySessionToken } = require("../lib/api");

function mockResponse() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
}

function request({ method = "POST", password, cookie, origin = "https://shop.test" } = {}) {
  return {
    method,
    body: password === undefined ? {} : { password },
    headers: {
      host: "shop.test",
      origin,
      "x-forwarded-proto": "https",
      ...(cookie ? { cookie } : {}),
    },
  };
}

async function call(handler, req) {
  const res = mockResponse();
  await handler(req, res);
  return res;
}

test("login rejects a password that does not match", () => {
  const res = mockResponse();
  login(request({ password: "senha incorreta" }), res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.authenticated, undefined);
  assert.equal(res.headers["set-cookie"], undefined);
});

test("login issues an HttpOnly session cookie and session endpoint verifies it", () => {
  const loginRes = mockResponse();
  login(request({ password: process.env.ADMIN_PASSWORD }), loginRes);

  assert.equal(loginRes.statusCode, 200);
  assert.equal(loginRes.body.authenticated, true);
  assert.match(loginRes.headers["set-cookie"], /HttpOnly/);
  assert.match(loginRes.headers["set-cookie"], /SameSite=Strict/);
  const cookie = loginRes.headers["set-cookie"].split(";")[0];

  const sessionRes = mockResponse();
  session(request({ method: "GET", cookie }), sessionRes);
  assert.equal(sessionRes.body.authenticated, true);

  const token = decodeURIComponent(cookie.split("=")[1]);
  assert.equal(verifySessionToken(token, Date.now() + 9 * 60 * 60 * 1000), false);
});

test("login rejects a cross-origin request", () => {
  const res = mockResponse();
  login(request({ password: process.env.ADMIN_PASSWORD, origin: "https://attacker.test" }), res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.headers["set-cookie"], undefined);
});

test("catalog and image writes reject requests without an admin session", async () => {
  const productRes = await call(products, request({ method: "PUT", password: undefined }));
  const uploadRes = await call(upload, request({ method: "POST" }));

  assert.equal(productRes.statusCode, 401);
  assert.equal(uploadRes.statusCode, 401);
});

test("XLSX import and export reject requests without an admin session", async () => {
  const exportRes = await call(exportProducts, request({ method: "GET" }));
  const importRes = await call(importProducts, request({ method: "POST" }));

  assert.equal(exportRes.statusCode, 401);
  assert.equal(importRes.statusCode, 401);
});

test("XLSX import rejects duplicate products before writing to Supabase", async () => {
  const loginRes = mockResponse();
  login(request({ password: process.env.ADMIN_PASSWORD }), loginRes);
  const cookie = loginRes.headers["set-cookie"].split(";")[0];
  const workbook = await createProductsWorkbook([
    { id: 1, n: "Camisa", d: "", p: 50, c: "Camisas", l: "https://br.shein.com/item/1", g: [], sizes: [], available: true },
    { id: 2, n: "Camisa", d: "", p: 60, c: "Camisas", l: "https://br.shein.com/item/2", g: [], sizes: [], available: true },
  ]);
  const req = request({ method: "POST", cookie });
  req.body = {
    file: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${workbook.toString("base64")}`,
  };
  const res = await call(importProducts, req);

  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /Produto duplicado na planilha/);
});

test("catalog and image writes reject cross-origin requests", async () => {
  const productRes = await call(
    products,
    request({ method: "PUT", origin: "https://attacker.test" }),
  );
  const uploadRes = await call(upload, request({ origin: "https://attacker.test" }));

  assert.equal(productRes.statusCode, 403);
  assert.equal(uploadRes.statusCode, 403);
});

test("catalog writes validate input before calling cloud storage", async () => {
  const loginRes = mockResponse();
  login(request({ password: process.env.ADMIN_PASSWORD }), loginRes);
  const cookie = loginRes.headers["set-cookie"].split(";")[0];
  const res = await call(
    products,
    {
      ...request({ method: "PUT", cookie }),
      body: { products: [{ id: 1, n: "", p: -1, c: "", l: "javascript:alert(1)" }] },
    },
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /nome, categoria, preço e link/);
});
