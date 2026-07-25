import { copyFile, mkdir, writeFile } from "node:fs/promises";

await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });

await writeFile(
  "dist/server/index.js",
  `export default {
  async fetch(request, env) {
    if (!env.ASSETS) {
      return new Response("Static asset binding unavailable.", { status: 503 });
    }

    return env.ASSETS.fetch(request);
  }
};
`,
  "utf8"
);

await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
