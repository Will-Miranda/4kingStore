const test = require("node:test");
const assert = require("node:assert/strict");

const { randomBytes } = require("node:crypto");

process.env.ADMIN_PASSWORD ||= randomBytes(32).toString("base64url");
process.env.ADMIN_SESSION_SECRET ||= randomBytes(48).toString("base64url");
process.env.BLOB_READ_WRITE_TOKEN = "token-falso-apenas-para-testes";
delete process.env.VERCEL;

const login = require("../api/admin/login");
const session = require("../api/admin/session");
const products = require("../api/products");
const upload = require("../api/upload");
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
