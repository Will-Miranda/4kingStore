const { isAdmin, sendJson } = require("../../lib/api");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Método não permitido." });
  }
  return sendJson(res, 200, { authenticated: isAdmin(req) });
};
