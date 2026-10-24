const { createHash, createHmac, timingSafeEqual } = require("node:crypto");

const COOKIE_NAME = "4ks_admin";
const SESSION_SECONDS = 8 * 60 * 60;

function sendJson(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [name, value] of Object.entries(extraHeaders)) {
    res.setHeader(name, value);
  }
  res.end(JSON.stringify(body));
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return false;

  const protocol = (req.headers["x-forwarded-proto"] || "https")
    .split(",")[0]
    .trim();
  try {
    return new URL(origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

function configurationError() {
  if (
    !process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD.length < 12 ||
    !process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET.length < 32
  ) {
    return "Configure ADMIN_PASSWORD (12+ caracteres) e ADMIN_SESSION_SECRET (32+ caracteres) na Vercel.";
  }
  return null;
}

function createSessionToken(now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(now / 1000) + SESSION_SECONDS }),
  ).toString("base64url");
  const signature = createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifySessionToken(token, now = Date.now()) {
  if (configurationError() || typeof token !== "string") return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return false;

  const expected = createHmac("sha256", process.env.ADMIN_SESSION_SECRET)
    .update(payload)
    .digest();
  let actual;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return Number.isInteger(data.exp) && data.exp > Math.floor(now / 1000);
  } catch {
    return false;
  }
}

function readAdminCookie(req) {
  const cookies = (req.headers.cookie || "").split(";");
  const entry = cookies.find((item) => item.trim().startsWith(`${COOKIE_NAME}=`));
  return entry ? entry.trim().slice(COOKIE_NAME.length + 1) : "";
}

function isAdmin(req) {
  return verifySessionToken(readAdminCookie(req));
}

function setAdminCookie(res, token, maxAge = SESSION_SECONDS) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`,
  );
}

function passwordMatches(password) {
  if (configurationError() || typeof password !== "string" || password.length > 1024) {
    return false;
  }
  const expected = createHash("sha256")
    .update(process.env.ADMIN_PASSWORD)
    .digest();
  const actual = createHash("sha256").update(password).digest();
  return timingSafeEqual(actual, expected);
}

function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  return {};
}

function requireAdmin(req, res) {
  if (!isAdmin(req)) {
    sendJson(res, 401, { error: "Sessão administrativa expirada. Entre novamente." });
    return false;
  }
  return true;
}

module.exports = {
  COOKIE_NAME,
  configurationError,
  createSessionToken,
  isAdmin,
  passwordMatches,
  readJsonBody,
  requireAdmin,
  sameOrigin,
  sendJson,
  setAdminCookie,
  verifySessionToken,
};
