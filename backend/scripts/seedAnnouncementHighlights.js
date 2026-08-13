const path = require("path");
const fs = require("fs");

const { admin, db, bucket } = require("../src/config/firebase");

const ANNOUNCEMENT_COL = "announcements";
const IMAGE_ROOT = path.resolve(__dirname, "../../frontend/src/assets/images");

const HIGHLIGHTS = [
  {
    id: "highlight-news-nepo-stray-cats",
    type: "News & Article",
    title: "Pag-rescue sa stray cats, nagpapatuloy sa Angeles City",
    caption: "Ipinagpatuloy ng Angeles City Veterinary Office ang stray cat rescue operation sa Nepo Mart bilang bahagi ng kanilang programa para sa animal welfare.",
    details: [
      "Ipinagpatuloy ng Angeles City Veterinary Office ang stray cat rescue operation sa Nepo Mart.",
      "Ligtas na dinala ang mga nahuling stray cat sa Angeles City Pound para sa observation at veterinary procedures.",
      "Hinihikayat ang mga Angeleno na maging responsableng pet owners at makibahagi sa animal welfare initiatives.",
    ],
    imageFile: "highlight-news-alert-palit-an.png",
    location: "Nepo Mart, Angeles City",
    publishedAt: "2026-07-21",
    source: "CLTV36 News",
  },
  {
    id: "highlight-news-cca-cat-rescue",
    type: "News & Article",
    title: "Stray cat rescue at CCA",
    caption: "Nagsagawa ng stray cat rescue operation ang Angeles City Veterinary Office sa City College of Angeles upang mapangalagaan ang mga ligaw na pusa.",
    details: [
      "Nagsagawa ng stray cat rescue operation ang Angeles City Veterinary Office sa City College of Angeles.",
      "Ligtas na nahuli at dinala sa Angeles City Pound ang mga stray cat upang mabigyan ng pagkalinga at serbisyong beterinaryo.",
      "Hinimok din ang mga Angeleno na isulong ang responsible pet ownership at i-report ang hayop na nangangailangan ng tulong.",
    ],
    imageFile: "news-cca-cat-rescue.png",
    location: "City College of Angeles",
    publishedAt: "2026-07-20",
    source: "CLTV36 News",
  },
  {
    id: "highlight-news-balibago-dog-rescue",
    type: "News & Article",
    title: "Aso na-rescue sa Balibago",
    caption: "Sa gitna ng search and rescue operations sa gumuhong ginagawang gusali sa Balibago, isang aso ang nailigtas at inilipat sa ligtas na pangangalaga.",
    details: [
      "Ayon sa ulat sa construction site, ang aso ay biglang nakita na papalabas mula sa rubble habang nagsasagawa ng operasyon.",
      "Agad itong inasikaso at inilipat sa ligtas na pangangalaga ng mga rescuers.",
      "Isasailalim ang aso sa masusing check-up ng City Veterinary Office ng Angeles City.",
    ],
    imageFile: "news-balibago-dog-rescue.jpg",
    location: "Balibago, Angeles City",
    publishedAt: "2025-05-14",
    source: "Angeles City Information Office",
  },
  {
    id: "highlight-success-zach",
    type: "Success Stories",
    title: "Zach starts a new life",
    caption: "Rescued dog Zach is now starting a new life with his loving fur-parent.",
    details: [
      "Rescued dog Zach is now starting a new life with his loving fur-parent.",
      "Zach was adopted by Hamara Dela Cruz of Brgy. Ninoy Aquino.",
      "His adoption supports the Angeles City Government's Adopt, Don't Shop initiative.",
    ],
    imageFile: "success-zach-adoption.jpg",
    location: "Brgy. Ninoy Aquino",
    publishedAt: "2026-07-18",
    source: "Angeles City Dog Pound and Animal Shelter",
  },
  {
    id: "highlight-success-lolong",
    type: "Success Stories",
    title: "Lolong welcomed home",
    caption: "Rescued cat Lolong is now starting a new life with a loving fur-parent.",
    details: [
      "Rescued cat Lolong is now starting a new life with a loving fur-parent.",
      "Lolong was welcomed by Analyn Rivera of Brgy. Anunas.",
      "The Angeles City Dog Pound and Animal Shelter continues to help rescued pets find forever homes.",
    ],
    imageFile: "success-lolong-adoption.jpg",
    location: "Brgy. Anunas",
    publishedAt: "2026-07-17",
    source: "Angeles City Dog Pound and Animal Shelter",
  },
  {
    id: "highlight-success-whity",
    type: "Success Stories",
    title: "Whity finds a family",
    caption: "Rescued cat Whity is now starting a new life with a loving fur-parent.",
    details: [
      "Rescued cat Whity is now starting a new life with a loving fur-parent.",
      "Whity was adopted by Noel Agustin of Barangay Margot.",
      "This adoption is part of the city's continuing effort to promote responsible pet ownership.",
    ],
    imageFile: "success-whity-adoption.jpg",
    location: "Barangay Margot",
    publishedAt: "2026-07-16",
    source: "Angeles City Dog Pound and Animal Shelter",
  },
  {
    id: "highlight-success-marcia",
    type: "Success Stories",
    title: "Marcia finds care",
    caption: "Rescued cat Marcia is now starting a new life with a loving fur-parent.",
    details: [
      "Rescued cat Marcia is now starting a new life with a loving fur-parent.",
      "Marcia was welcomed by Analyn Rivera of Brgy. Anunas.",
      "The shelter gives rescued animals not just temporary care, but a chance at a forever home.",
    ],
    imageFile: "success-marcia-adoption.jpg",
    location: "Brgy. Anunas",
    publishedAt: "2026-07-15",
    source: "Angeles City Dog Pound and Animal Shelter",
  },
  {
    id: "demo-upcoming-event",
    type: "Upcoming Events",
    title: "Veterinary Services Brought Closer to Angelenos",
    caption: "The City of Angeles continues its free anti-rabies vaccination program to protect pets and help prevent the spread of rabies in local communities.",
    details: [
      "Free anti-rabies vaccination services will be brought closer to local communities.",
      "Pet owners are encouraged to prepare their pets and follow the guidance of the City Veterinary Office team.",
      "This program supports healthier pets and safer neighborhoods across Angeles City.",
    ],
    imageFile: "highlight-upcoming-event.jpg",
    eventDate: "2026-08-16",
    eventTime: "9:00 AM - 3:00 PM",
    location: "Savannah Phase 1, Savannah Phase 2, and Green Plain Phase 3",
    publishedAt: "2026-08-02",
    source: "Angeles City Veterinary Office",
  },
];

function contentTypeFor(fileName) {
  if (fileName.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

async function uploadSeedImage(item) {
  const localPath = path.join(IMAGE_ROOT, item.imageFile);
  if (!fs.existsSync(localPath)) {
    throw new Error(`Missing announcement image: ${localPath}`);
  }

  const extension = path.extname(item.imageFile).toLowerCase();
  const imagePath = `announcements/${item.id}/seed-cover${extension}`;
  const imageFile = bucket.file(imagePath);
  await imageFile.save(fs.readFileSync(localPath), {
    metadata: {
      contentType: contentTypeFor(item.imageFile),
      cacheControl: "private, max-age=1800",
    },
    resumable: false,
  });
  return {
    imagePath,
    imageUrl: "",
  };
}

async function seedAnnouncementHighlights() {
  let created = 0;
  let skipped = 0;

  for (const item of HIGHLIGHTS) {
    const ref = db.collection(ANNOUNCEMENT_COL).doc(item.id);
    const existing = await ref.get();
    if (existing.exists) {
      skipped += 1;
      continue;
    }

    const { imagePath, imageUrl } = await uploadSeedImage(item);
    const publishedDate = new Date(`${item.publishedAt}T08:00:00+08:00`);
    await ref.set({
      title: item.title,
      type: item.type,
      caption: item.caption,
      details: item.details,
      storyParagraphs: [],
      description: "",
      body: "",
      content: "",
      summary: "",
      imagePath,
      imageUrl,
      eventDate: item.eventDate || "",
      eventTime: item.eventTime || "",
      location: item.location || "",
      source: item.source,
      status: "Published",
      visibleToPublic: true,
      createdBy: "content-migration@animua.local",
      createdByName: item.source,
      createdByRole: "Staff",
      createdAt: admin.firestore.Timestamp.fromDate(publishedDate),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: "content-migration@animua.local",
      seededHighlight: true,
    });
    created += 1;
  }

  console.log(`Announcement highlights ready: ${created} created, ${skipped} already present.`);
}

seedAnnouncementHighlights()
  .then(() => admin.app().delete())
  .catch(async (error) => {
    console.error("Unable to seed announcement highlights:", error.message);
    await admin.app().delete().catch(() => {});
    process.exitCode = 1;
  });
