const { sameOrigin, sendJson, setAdminCookie } = require("../../lib/api");

module.exports = function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Método não permitido." });
  }
  if (!sameOrigin(req)) {
    return sendJson(res, 403, { error: "Origem da solicitação não autorizada." });
  }

  setAdminCookie(res, "", 0);
  return sendJson(res, 200, { authenticated: false });
};
