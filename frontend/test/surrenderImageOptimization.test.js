import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/public/js/surrenderForm.js", import.meta.url), "utf8");

function optimizerFor(width, height, encodedSize) {
  const canvases = [];
  const context = vm.createContext({
    FileReader: class {
      readAsDataURL() { this.result = "data:image/jpeg;base64,AAAA"; this.onload(); }
    },
    Image: class {
      naturalWidth = width;
      naturalHeight = height;
      set src(value) { this.onload(); }
    },
    document: {
      createElement() {
        const canvas = {
          getContext: () => ({ fillRect() {}, drawImage() {} }),
          toDataURL: (_type, quality) => `data:image/jpeg;base64,${"A".repeat(Math.ceil(encodedSize(quality) / 3) * 4)}`,
        };
        canvases.push(canvas);
        return canvas;
      },
    },
  });
  vm.runInContext([
    source.match(/const MAX_PROCESSED_IMAGE_SIZE = .*;/)[0],
    source.match(/const MAX_PROCESSED_IMAGE_SIDE = .*;/)[0],
    source.slice(source.indexOf("function getDataUrlByteSize("), source.indexOf("function bindIdentityDocumentUploads(")),
  ].join("\n"), context);
  return { optimize: context.optimizeImageUpload, canvases };
}

test("a 48-megapixel phone photo reaches the encoder instead of failing before resizing", async () => {
  const { optimize, canvases } = optimizerFor(8000, 6000, () => 100_000);
  const result = await optimize({ name: "phone.jpg" });
  assert.equal(canvases[0].width, 1600);
  assert.equal(canvases[0].height, 1200);
  assert.equal(result.type, "image/jpeg");
});

test("three detailed photos leave room for the request within the database document limit", async () => {
  const { optimize } = optimizerFor(1600, 1200, (quality) => quality > 0.75 ? 380_000 : 210_000);
  const photos = await Promise.all(["front", "back", "animal"].map((name) => optimize({ name: `${name}.jpg` })));
  const documentBytes = Buffer.byteLength(JSON.stringify({ photos, otherDetails: "x".repeat(40_000) }));
  assert.ok(documentBytes < 1_048_576, `Combined document is ${documentBytes} bytes`);
});
