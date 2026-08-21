const ALLOWED_BROWSER_ORIGINS = [
  "https://animua-angelescity.web.app",
  "https://animua-angelescity.firebaseapp.com",
  "https://animua-admin.web.app",
  "https://animua-admin.firebaseapp.com",
];

function isLocalDevelopmentOrigin(origin) {
  return (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  );
}

function isAllowedBrowserOrigin(origin) {
  if (!origin) return false;

  return (
    ALLOWED_BROWSER_ORIGINS.includes(origin) ||
    isLocalDevelopmentOrigin(origin)
  );
}

module.exports = {
  ALLOWED_BROWSER_ORIGINS,
  isAllowedBrowserOrigin,
};
