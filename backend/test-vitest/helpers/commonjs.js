const path = require("path");

const fromTestDirectory = (modulePath) =>
  modulePath.startsWith(".")
    ? require.resolve(path.resolve(__dirname, "..", modulePath))
    : require.resolve(modulePath);

function loadWithMocks(moduleRelativePath, mocks = {}) {
  const modulePath = fromTestDirectory(moduleRelativePath);
  const saved = new Map();

  for (const [dependencyPath, exports] of Object.entries(mocks)) {
    const resolved = fromTestDirectory(dependencyPath);
    saved.set(resolved, require.cache[resolved]);
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports,
    };
  }

  const originalModule = require.cache[modulePath];
  delete require.cache[modulePath];
  try {
    return require(modulePath);
  } finally {
    delete require.cache[modulePath];
    if (originalModule) require.cache[modulePath] = originalModule;
    for (const [resolved, original] of saved) {
      if (original) require.cache[resolved] = original;
      else delete require.cache[resolved];
    }
  }
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    status: vi.fn(function status(code) { this.statusCode = code; return this; }),
    json: vi.fn(function json(body) { this.body = body; return this; }),
    set: vi.fn(function set(name, value) { this.headers[name] = value; return this; }),
    cookie: vi.fn(function cookie(name, value, options) {
      this.cookies ||= [];
      this.cookies.push({ name, value, options });
      return this;
    }),
    clearCookie: vi.fn(function clearCookie(name, options) {
      this.clearedCookies ||= [];
      this.clearedCookies.push({ name, options });
      return this;
    }),
  };
}

function snapshot(data, id = "doc-id") {
  return {
    id,
    exists: data !== undefined,
    data: () => data,
  };
}

module.exports = { loadWithMocks, responseRecorder, snapshot };
