const { isAllowedBrowserOrigin } = require("../config/browserOrigins");
const { getSessionCookieToken } = require("../utils/sessionCookie");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function getRequestOrigin(req) {
  const origin = String(req.headers.origin || "").trim();
  if (origin) return origin;

  const referer = String(req.headers.referer || "").trim();
  if (!referer) return "";

  try {
    return new URL(referer).origin;
  } catch (_) {
    return "";
  }
}

function protectCookieAuthenticatedMutation(req, res, next) {
  if (
    SAFE_METHODS.has(String(req.method || "").toUpperCase()) ||
    !getSessionCookieToken(req)
  ) {
    return next();
  }

  const requestOrigin = getRequestOrigin(req);
  if (isAllowedBrowserOrigin(requestOrigin)) return next();

  return res.status(403).json({
    message: "Request origin could not be verified.",
  });
}

module.exports = protectCookieAuthenticatedMutation;
module.exports.getRequestOrigin = getRequestOrigin;
