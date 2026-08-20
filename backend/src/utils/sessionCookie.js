const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const PRODUCTION_COOKIE_NAME = "__Host-animua_session";
const DEVELOPMENT_COOKIE_NAME = "animua_session";
const SESSION_COOKIE_NAMES = [
  PRODUCTION_COOKIE_NAME,
  DEVELOPMENT_COOKIE_NAME,
];

function isProductionEnvironment(env = process.env) {
  return env.NODE_ENV === "production";
}

function getSessionCookieName(env = process.env) {
  return isProductionEnvironment(env)
    ? PRODUCTION_COOKIE_NAME
    : DEVELOPMENT_COOKIE_NAME;
}

function getSessionCookieOptions(env = process.env) {
  const production = isProductionEnvironment(env);

  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS,
    ...(production ? { partitioned: true } : {}),
  };
}

function getClearCookieOptions(env = process.env) {
  const { maxAge, ...options } = getSessionCookieOptions(env);
  return options;
}

function parseCookieHeader(cookieHeader = "") {
  return String(cookieHeader)
    .split(";")
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex < 1) return cookies;

      const name = part.slice(0, separatorIndex).trim();
      const rawValue = part.slice(separatorIndex + 1).trim();

      try {
        cookies[name] = decodeURIComponent(rawValue);
      } catch (_) {
        cookies[name] = rawValue;
      }

      return cookies;
    }, {});
}

function getSessionCookieToken(req) {
  const cookies = parseCookieHeader(req?.headers?.cookie);

  for (const name of SESSION_COOKIE_NAMES) {
    if (cookies[name]) return cookies[name];
  }

  return "";
}

function setSessionCookie(res, token, env = process.env) {
  res.cookie(
    getSessionCookieName(env),
    token,
    getSessionCookieOptions(env)
  );
  res.set("Cache-Control", "no-store");
}

function clearSessionCookies(res, env = process.env) {
  const options = getClearCookieOptions(env);

  SESSION_COOKIE_NAMES.forEach((name) => {
    res.clearCookie(name, options);
  });
  res.set("Cache-Control", "no-store");
}

module.exports = {
  SESSION_DURATION_MS,
  SESSION_COOKIE_NAMES,
  clearSessionCookies,
  getSessionCookieName,
  getSessionCookieOptions,
  getSessionCookieToken,
  parseCookieHeader,
  setSessionCookie,
};
