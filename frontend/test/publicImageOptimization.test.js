import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isOptimizablePublicImage,
  optimizedPublicImageUrl,
} from "../src/utils/image.js";

test("Firebase Storage photos use the public WebP resizing endpoint", () => {
  const original = "https://storage.googleapis.com/animua-bucket/animals/A-1/profile.jpg?signature=abc";
  const optimized = optimizedPublicImageUrl(original, 560);

  assert.equal(isOptimizablePublicImage(original), true);
  assert.match(optimized, /^http:\/\/localhost:5000\/api\/public\/optimized-image\?width=560&src=/);
  assert.equal(new URL(optimized).searchParams.get("src"), original);
});

test("local, data, blob, and unrelated external images bypass the proxy", () => {
  const images = [
    "/images/animua_logo1.svg",
    "../../src/assets/images/dog.jpg",
    "data:image/webp;base64,abc",
    "blob:https://animua.life/example",
    "https://loremflickr.com/500/360/dog",
  ];

  images.forEach((image) => {
    assert.equal(isOptimizablePublicImage(image), false);
    assert.equal(optimizedPublicImageUrl(image, 400), image);
  });
});

test("optimization widths stay within the server-supported range", () => {
  const original = "https://firebasestorage.googleapis.com/v0/b/animua/o/photo.jpg";

  assert.equal(new URL(optimizedPublicImageUrl(original, 1)).searchParams.get("width"), "96");
  assert.equal(new URL(optimizedPublicImageUrl(original, 5000)).searchParams.get("width"), "900");
});

test("image-heavy public views use resized sources and native lazy loading", async () => {
  const [findFurbabies, announcements, publicUi, home] = await Promise.all([
    readFile(new URL("../src/public/js/find-furbabies.js", import.meta.url), "utf8"),
    readFile(new URL("../src/public/js/announcements.js", import.meta.url), "utf8"),
    readFile(new URL("../src/public/js/public-ui.js", import.meta.url), "utf8"),
    readFile(new URL("../pages/public/home.html", import.meta.url), "utf8"),
  ]);

  assert.match(findFurbabies, /optimizedPublicImageUrl\(originalImage, PET_CARD_IMAGE_WIDTH\)/);
  assert.match(findFurbabies, /loading="lazy" decoding="async" fetchpriority="low"/);
  assert.match(announcements, /optimizedPublicImageUrl\(originalSrc, isFeatured \? 720 : 520\)/);
  assert.match(publicUi, /optimizedPublicImageUrl\(originalImage, 560\)/);
  assert.match(home, /highlight-new-furbabies-cat-360\.webp[^>]+loading="lazy"/);
});
