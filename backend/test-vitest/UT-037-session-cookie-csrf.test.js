const {
  getSessionCookieName,
  getSessionCookieOptions,
  getSessionCookieToken,
  parseCookieHeader,
  setSessionCookie,
} = require("../src/utils/sessionCookie");
const protectCookieAuthenticatedMutation = require("../src/middleware/csrfProtection");
const { loadWithMocks, responseRecorder, snapshot } = require("./helpers/commonjs");

describe("UT-037 — HttpOnly Session Cookie and CSRF Protection", () => {
  it("uses a host-bound, HttpOnly, partitioned production cookie", () => {
    const env = { NODE_ENV: "production" };

    expect(getSessionCookieName(env)).toBe("__Host-animua_session");
    expect(getSessionCookieOptions(env)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000,
      partitioned: true,
    });
  });

  it("uses a local-development cookie that works over HTTP localhost", () => {
    expect(getSessionCookieName({ NODE_ENV: "test" })).toBe("animua_session");
    expect(getSessionCookieOptions({ NODE_ENV: "test" })).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });
  });

  it("extracts only the supported session cookie names", () => {
    expect(parseCookieHeader("theme=dark; animua_session=jwt.value.sig")).toEqual({
      theme: "dark",
      animua_session: "jwt.value.sig",
    });
    expect(getSessionCookieToken({
      headers: { cookie: "theme=dark; animua_session=jwt.value.sig" },
    })).toBe("jwt.value.sig");
  });

  it("prefers the cookie for the active environment when stale cookies coexist", () => {
    const req = {
      headers: {
        cookie: "__Host-animua_session=production-token; animua_session=development-token",
      },
    };

    expect(getSessionCookieToken(req, { NODE_ENV: "development" }))
      .toBe("development-token");
    expect(getSessionCookieToken(req, { NODE_ENV: "production" }))
      .toBe("production-token");
  });

  it("clears the alternate cookie before setting a new session", () => {
    const res = responseRecorder();

    setSessionCookie(res, "fresh-token", { NODE_ENV: "development" });

    expect(res.clearedCookies).toEqual([
      {
        name: "__Host-animua_session",
        options: {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          path: "/",
          partitioned: true,
        },
      },
    ]);
    expect(res.cookies).toEqual([
      {
        name: "animua_session",
        value: "fresh-token",
        options: expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
        }),
      },
    ]);
  });

  it("permits an approved browser origin for a cookie-authenticated mutation", () => {
    const req = {
      method: "PATCH",
      headers: {
        cookie: "animua_session=jwt.value.sig",
        origin: "https://animua-admin.web.app",
      },
    };
    const next = vi.fn();

    protectCookieAuthenticatedMutation(req, responseRecorder(), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects an unapproved or missing browser origin for a cookie-authenticated mutation", () => {
    for (const origin of ["https://attacker.example", ""]) {
      const req = {
        method: "POST",
        headers: {
          cookie: "animua_session=jwt.value.sig",
          ...(origin ? { origin } : {}),
        },
      };
      const res = responseRecorder();
      const next = vi.fn();

      protectCookieAuthenticatedMutation(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    }
  });

  it("does not impose browser-origin checks on safe methods or bearer-only callers", () => {
    for (const req of [
      { method: "GET", headers: { cookie: "animua_session=jwt.value.sig" } },
      { method: "POST", headers: { authorization: "Bearer jwt.value.sig" } },
    ]) {
      const next = vi.fn();
      protectCookieAuthenticatedMutation(req, responseRecorder(), next);
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it("authenticates an active account from the session cookie without an Authorization header", async () => {
    const verify = vi.fn(() => ({ email: "staff@test.com" }));
    const get = vi.fn(async () => snapshot({
      firstName: "Ana",
      lastName: "Reyes",
      role: "Staff",
      status: "Active",
    }, "staff@test.com"));
    const authenticateToken = loadWithMocks("../src/middleware/authMiddleware", {
      "../src/config/firebase": { db: { collection: () => ({ doc: () => ({ get }) }) } },
      jsonwebtoken: { verify },
    });
    const req = { headers: { cookie: "animua_session=cookie-token" } };
    const next = vi.fn();

    await authenticateToken(req, responseRecorder(), next);

    expect(verify).toHaveBeenCalledWith("cookie-token", process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    expect(next).toHaveBeenCalledOnce();
  });
});
