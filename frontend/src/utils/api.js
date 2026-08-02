const LOCAL_API_BASE_URL = "http://localhost:5000/api";
const PRODUCTION_API_BASE_URL = "https://animua-backend.onrender.com/api";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");

const isLocalHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const API_BASE_URL = isLocalHost
  ? (configuredApiBaseUrl || LOCAL_API_BASE_URL)
  : (configuredApiBaseUrl || PRODUCTION_API_BASE_URL);
