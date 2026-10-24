const {
  configurationError,
  createSessionToken,
  passwordMatches,
  readJsonBody,
  sameOrigin,
  sendJson,
  setAdminCookie,
} = require("../../lib/api");

module.exports = function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Método não permitido." });
  }
  if (!sameOrigin(req)) {
    return sendJson(res, 403, { error: "Origem da solicitação não autorizada." });
  }

  const configError = configurationError();
  if (configError) return sendJson(res, 503, { error: configError });

  let body;
  try {
    body = readJsonBody(req);
  } catch {
    return sendJson(res, 400, { error: "Corpo da solicitação inválido." });
  }
  if (!passwordMatches(body.password)) {
    return sendJson(res, 401, { error: "Senha do administrador incorreta." });
  }

  setAdminCookie(res, createSessionToken());
  return sendJson(res, 200, { authenticated: true });
};
