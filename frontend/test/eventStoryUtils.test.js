import assert from "node:assert/strict";
import test from "node:test";

import { deduplicateEventStories } from "../src/public/js/event-story-utils.js";

test("upcoming event stories remove duplicate records with the same id", () => {
  const stories = deduplicateEventStories([
    { id: "anti-rabies", title: "Libreng Anti-Rabies Vaccination", date: "2026-09-10", image: "front.jpg" },
    { id: "anti-rabies", title: "Libreng Anti-Rabies Vaccination", date: "2026-09-10", image: "side.jpg" },
  ]);

  assert.equal(stories.length, 1);
  assert.equal(stories[0].image, "front.jpg");
});

test("upcoming event stories remove cross-feed duplicates with matching details", () => {
  const stories = deduplicateEventStories([
    {
      id: "announcement-123",
      title: "Libreng Anti-Rabies Vaccination",
      eventDate: "2026-09-10",
      location: "Barangay Hall",
      image: "announcement-angle.jpg",
    },
    {
      id: "event-456",
      title: "LIBRENG ANTI RABIES VACCINATION!",
      date: "2026-09-10T00:00:00+08:00",
      venue: "Barangay Hall",
      image: "event-angle.jpg",
    },
    {
      id: "event-789",
      title: "Pet Adoption Day",
      date: "2026-09-12",
      location: "City Plaza",
    },
  ]);

  assert.deepEqual(stories.map((story) => story.id), ["announcement-123", "event-789"]);
});

test("separate editions of a recurring event remain separate stories", () => {
  const stories = deduplicateEventStories([
    { id: "event-a", title: "Anti-Rabies Vaccination", date: "2026-09-10", location: "Barangay Hall" },
    { id: "event-b", title: "Anti-Rabies Vaccination", date: "2026-09-17", location: "Barangay Hall" },
    { id: "event-c", title: "Anti-Rabies Vaccination", date: "2026-09-10", location: "City Plaza" },
  ]);

  assert.deepEqual(stories.map((story) => story.id), ["event-a", "event-b", "event-c"]);
});
