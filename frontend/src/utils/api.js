const LOCAL_API_BASE_URL = "http://localhost:5000/api";
const PRODUCTION_API_BASE_URL = "https://animua-backend.onrender.com/api";

const isLocalHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const API_BASE_URL = isLocalHost
  ? LOCAL_API_BASE_URL
  : PRODUCTION_API_BASE_URL;
