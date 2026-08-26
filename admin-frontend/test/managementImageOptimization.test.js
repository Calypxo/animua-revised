import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  installManagementImageFallbacks,
  isOptimizableManagementImage,
  optimizedManagementImageUrl,
} from "../src/utils/image.js";

test("management Firebase photos use the WebP resizing endpoint", () => {
  const original = "https://storage.googleapis.com/animua-bucket/animals/A-1/profile.jpg?signature=abc";
  const optimized = optimizedManagementImageUrl(original, 480);

  assert.equal(isOptimizableManagementImage(original), true);
  assert.match(optimized, /^http:\/\/localhost:5000\/api\/public\/optimized-image\?width=480&src=/);
  assert.equal(new URL(optimized).searchParams.get("src"), original);
});

test("inline, local, blob, and unrelated external images bypass resizing", () => {
  const images = [
    "/images/animua_logo1.svg",
    "data:image/webp;base64,abc",
    "blob:https://animua.life/example",
    "https://example.com/photo.jpg",
  ];

  images.forEach((image) => {
    assert.equal(isOptimizableManagementImage(image), false);
    assert.equal(optimizedManagementImageUrl(image, 320), image);
  });
});

test("management image widths stay within the backend limits", () => {
  const original = "https://firebasestorage.googleapis.com/v0/b/animua/o/photo.jpg";

  assert.equal(new URL(optimizedManagementImageUrl(original, 1)).searchParams.get("width"), "96");
  assert.equal(new URL(optimizedManagementImageUrl(original, 5000)).searchParams.get("width"), "900");
});

test("a failed resized image retries its original before revealing the fallback", () => {
  let errorHandler;
  let fallbackRevealed = false;
  const original = "https://storage.googleapis.com/animua-bucket/animals/A-1/original.jpg";
  const image = {
    dataset: { originalSrc: original },
    hidden: false,
    renderedSrc: "http://localhost:5000/api/public/optimized-image?width=480",
    addEventListener(type, handler) {
      if (type === "error") errorHandler = handler;
    },
    getAttribute(name) {
      return name === "src" ? this.renderedSrc : "";
    },
    set src(value) {
      this.renderedSrc = value;
    },
    parentElement: {
      querySelector() {
        return { removeAttribute: () => { fallbackRevealed = true; } };
      },
    },
  };
  const root = {
    matches: () => false,
    querySelectorAll: () => [image],
  };

  installManagementImageFallbacks(root);
  errorHandler();
  assert.equal(image.renderedSrc, original);
  assert.equal(image.hidden, false);

  errorHandler();
  assert.equal(image.hidden, true);
  assert.equal(fallbackRevealed, true);
});

test("photo-heavy management views use resized sources and native lazy loading", async () => {
  const [profiling, profile, adoption, surrender, announcements] = await Promise.all([
    readFile(new URL("../src/management/animalProfiling.js", import.meta.url), "utf8"),
    readFile(new URL("../src/management/animalProfile.js", import.meta.url), "utf8"),
    readFile(new URL("../src/management/adoptionApps.js", import.meta.url), "utf8"),
    readFile(new URL("../src/management/surrenderRequests.js", import.meta.url), "utf8"),
    readFile(new URL("../src/management/announcements.js", import.meta.url), "utf8"),
  ]);

  assert.match(profiling, /optimizedManagementImageUrl\(originalPhoto, 480\)/);
  assert.match(profiling, /loading="lazy" decoding="async" fetchpriority="low"/);
  assert.match(profile, /optimizedManagementImageUrl\(originalPhoto, 320\)/);
  assert.match(adoption, /optimizedManagementImageUrl\(originalPhoto, 128\)/);
  assert.match(surrender, /loading="lazy" decoding="async"/);
  assert.match(announcements, /optimizedManagementImageUrl\(originalImage, 900\)/);
});
