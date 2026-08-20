const { createContactRateLimiter, rejectContactHoneypot } = require("../src/middleware/contactProtection");
const { responseRecorder } = require("./helpers/commonjs");

describe("UT-011 — Contact Rate Limiting and Honeypot Protection", () => {
  it("Scenario 1 — allows the first two same-IP requests at limit two", () => {
    const limiter = createContactRateLimiter({ windowMs: 60000, maxRequests: 2, now: () => 1000 });
    const next = vi.fn(); const req = { ip: "127.0.0.1" };
    limiter(req, responseRecorder(), next); limiter(req, responseRecorder(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });
  it("Scenario 2 — blocks the third request with HTTP 429 and retry information", () => {
    const limiter = createContactRateLimiter({ windowMs: 60000, maxRequests: 2, now: () => 1000 });
    const req = { ip: "127.0.0.1" };
    limiter(req, responseRecorder(), vi.fn()); limiter(req, responseRecorder(), vi.fn());
    const res = responseRecorder(); const next = vi.fn(); limiter(req, res, next);
    expect(res.statusCode).toBe(429); expect(res.headers["Retry-After"]).toBe("60"); expect(next).not.toHaveBeenCalled();
  });
  it("Scenario 3 — allows requests after the window resets", () => {
    let now = 1000; const limiter = createContactRateLimiter({ windowMs: 500, maxRequests: 1, now: () => now });
    const next = vi.fn(); const req = { ip: "127.0.0.1" };
    limiter(req, responseRecorder(), next); now = 1501; limiter(req, responseRecorder(), next);
    expect(next).toHaveBeenCalledTimes(2);
  });
  it("Scenario 4 — returns the exact neutral HTTP 201 response for a filled honeypot", () => {
    const res = responseRecorder(); const next = vi.fn();
    rejectContactHoneypot({ body: { website: "spam.example" } }, res, next);
    expect(res.statusCode).toBe(201); expect(res.body).toEqual({ message: "Your message has been received by the ANIMUA team.", accepted: true }); expect(next).not.toHaveBeenCalled();
  });
  it("Scenario 5 — continues for an empty honeypot", () => {
    const next = vi.fn(); rejectContactHoneypot({ body: { website: "" } }, responseRecorder(), next); expect(next).toHaveBeenCalledOnce();
  });
});
