const { db } = require("../config/firebase");
const { buildShelterLabel } = require("../utils/animalIdentity");
const { reconcileRequestDeadlines } = require("../services/requestDeadlineService");
const {
  getCurrentAnimalProfiles,
} = require("../services/dashboardMetricsService");

const ATTENTION_CACHE_TTL_MS = Math.max(
  60_000,
  Number(process.env.ATTENTION_CACHE_TTL_MS) || 15 * 60_000
);

let attentionCache = null;
let attentionRefreshPromise = null;

exports.invalidateAttentionCache = function invalidateAttentionCache() {
  attentionCache = null;
};

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const seconds = value._seconds ?? value.seconds;
  const parsed = typeof seconds === "number"
    ? new Date(seconds * 1000)
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysSince(value) {
  const date = toDate(value);
  return date
    ? Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000))
    : 0;
}

function inventoryLevel(item = {}) {
  const currentStock = Number(
    item.currentStock ?? item.quantity ?? item.stock ?? item.onHand ?? 0
  );
  const reorderPoint = Number(
    item.reorderPoint ?? item.minimumStock ?? item.minStock ?? 0
  );
  const criticalPoint = Number(
    item.criticalPoint ?? Math.max(1, Math.floor(reorderPoint * 0.5))
  );

  if (currentStock <= criticalPoint) return "Critical";
  if (reorderPoint > 0 && currentStock <= reorderPoint) return "Low";
  return "OK";
}

async function countDocuments(query) {
  const snapshot = await query.count().get();
  return Number(snapshot.data().count || 0);
}

async function buildAttentionSummary() {
  await reconcileRequestDeadlines();
  const intake = db.collection("intakeRecords");
  const animals = db.collection("animals");
  const inventory = db.collection("inventoryItems");
  const contactMessages = db.collection("contactMessages");

  const [
    totalIntakes,
    convertedIntakes,
    rejectedIntakes,
    archivedIntakes,
    pendingAdoptions,
    pendingSurrenders,
    quarantine,
    animalSnapshot,
    inventorySnapshot,
    newContactMessages,
    approvedAdoptionSnapshot,
    approvedSurrenderSnapshot,
  ] = await Promise.all([
    countDocuments(intake),
    countDocuments(intake.where("status", "==", "Converted")),
    countDocuments(intake.where("status", "==", "Rejected")),
    countDocuments(intake.where("status", "==", "Archived")),
    countDocuments(db.collection("adoptions").where("status", "==", "Pending")),
    countDocuments(db.collection("surrenderRequests").where("status", "==", "Pending")),
    countDocuments(animals.where("status", "==", "Quarantine")),
    animals.select("status", "intakeDate", "createdAt").get(),
    inventory
      .select(
        "currentStock",
        "quantity",
        "stock",
        "onHand",
        "reorderPoint",
        "minimumStock",
        "minStock",
        "criticalPoint"
      )
      .get(),
    countDocuments(contactMessages.where("status", "==", "New")),
    db.collection("adoptions").where("status", "==", "Approved").select("noShowRisk").get(),
    db.collection("surrenderRequests").where("status", "==", "Approved").select("noShowRisk").get(),
  ]);

  const longStayCount = animalSnapshot.docs.reduce((count, document) => {
    const animal = document.data();
    if (["Adopted", "Archived"].includes(animal.status)) return count;
    return daysSince(animal.intakeDate || animal.createdAt) > 60
      ? count + 1
      : count;
  }, 0);

  let lowStockCount = 0;
  let criticalStockCount = 0;
  inventorySnapshot.docs.forEach((document) => {
    const level = inventoryLevel(document.data());
    if (level === "Critical") {
      criticalStockCount += 1;
      lowStockCount += 1;
    } else if (level === "Low") {
      lowStockCount += 1;
    }
  });

  const generatedAt = new Date();
  const adoptionNoShowRisk = approvedAdoptionSnapshot.docs.filter((doc) => doc.data().noShowRisk === true).length;
  const surrenderNoShowRisk = approvedSurrenderSnapshot.docs.filter((doc) => doc.data().noShowRisk === true).length;
  return {
    intake: Math.max(
      0,
      totalIntakes - convertedIntakes - rejectedIntakes - archivedIntakes
    ),
    pendingAdoptions,
    pendingSurrenders,
    quarantine,
    lowStockCount,
    criticalStockCount,
    longStayCount,
    newContactMessages,
    adoptionNoShowRisk,
    surrenderNoShowRisk,
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + ATTENTION_CACHE_TTL_MS).toISOString(),
  };
}

async function getCachedAttentionSummary(forceRefresh = false) {
  if (
    !forceRefresh &&
    attentionCache &&
    attentionCache.expiresAt > Date.now()
  ) {
    return { ...attentionCache.data, cached: true };
  }

  if (!attentionRefreshPromise) {
    attentionRefreshPromise = buildAttentionSummary()
      .then((data) => {
        attentionCache = {
          data,
          expiresAt: Date.now() + ATTENTION_CACHE_TTL_MS,
        };
        return data;
      })
      .finally(() => {
        attentionRefreshPromise = null;
      });
  }

  const data = await attentionRefreshPromise;
  return { ...data, cached: false };
}

exports.getAttentionSummary = async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === "1";
    const summary = await getCachedAttentionSummary(forceRefresh);
    res.set("Cache-Control", "private, max-age=60");
    return res.json(summary);
  } catch (error) {
    console.error("[getAttentionSummary]", error);
    return res.status(500).json({
      message: "Failed to load the management attention summary.",
    });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const [
      intakeSnapshot,
      animalSnapshot,
      adoptionSnapshot,
      surrenderSnapshot,
      inventorySnapshot,
      auditSnapshot,
    ] = await Promise.all([
      db.collection("intakeRecords").get(),
      db.collection("animals").get(),
      db.collection("adoptions").get(),
      db.collection("surrenderRequests").get(),
      db.collection("inventoryItems").get(),
      db.collection("auditLogs").orderBy("timestamp", "desc").limit(10).get(),
    ]);

    const mapDocuments = (snapshot) =>
      snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));

    const intakes = mapDocuments(intakeSnapshot);
    const animals = mapDocuments(animalSnapshot);
    const adoptions = mapDocuments(adoptionSnapshot);
    const surrenders = mapDocuments(surrenderSnapshot);
    const inventory = mapDocuments(inventorySnapshot);

    const activeIntakes = intakes.filter(
      (record) =>
        !["Converted", "Rejected", "Archived"].includes(record.status)
    );
    const countStatus = (status) =>
      animals.filter((animal) => animal.status === status).length;
    const pendingAdoptions = adoptions.filter(
      (application) => application.status === "Pending"
    );
    const pendingSurrenders = surrenders.filter(
      (request) => request.status === "Pending"
    );

    const lowStockItems = inventory
      .map((item) => ({
        id: item.id,
        name: item.itemDescription || item.name || item.id,
        category: item.category || "Uncategorized",
        currentStock: Number(
          item.currentStock ?? item.quantity ?? item.stock ?? item.onHand ?? 0
        ),
        unit: item.unit || "pcs",
        level: inventoryLevel(item),
      }))
      .filter((item) => item.level !== "OK")
      .sort((left, right) => {
        if (left.level === right.level) {
          return left.currentStock - right.currentStock;
        }
        return left.level === "Critical" ? -1 : 1;
      });

    const currentAnimals = getCurrentAnimalProfiles(animals);
    const currentYear = new Date().getFullYear();
    const monthlyData = {
      labels: [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ],
      intake: Array(12).fill(0),
      adoptions: Array(12).fill(0),
    };
    const addToMonth = (target, value) => {
      const date = toDate(value);
      if (date && date.getFullYear() === currentYear) {
        target[date.getMonth()] += 1;
      }
    };
    intakes.forEach((record) =>
      addToMonth(monthlyData.intake, record.intakeDate || record.createdAt)
    );
    adoptions
      .filter((application) => application.status === "Finalized")
      .forEach((application) =>
        addToMonth(
          monthlyData.adoptions,
          application.adoptionDate || application.updatedAt
        )
      );

    const speciesCounts = new Map();
    currentAnimals.forEach((animal) => {
      const species = animal.species || "Other";
      speciesCounts.set(species, (speciesCounts.get(species) || 0) + 1);
    });
    const speciesColors = [
      "#b86a00", "#2558a8", "#0d6e6e", "#186534", "#8c8481",
    ];
    const species = [...speciesCounts.entries()].map(
      ([label, count], index) => ({
        label,
        count,
        color: speciesColors[index % speciesColors.length],
      })
    );

    const stayDistribution = {
      labels: ["0-7d", "8-14d", "15-30d", "31-60d", "60+d"],
      data: [0, 0, 0, 0, 0],
    };
    currentAnimals.forEach((animal) => {
      const stay = daysSince(animal.intakeDate || animal.createdAt);
      const bucket =
        stay <= 7 ? 0 :
        stay <= 14 ? 1 :
        stay <= 30 ? 2 :
        stay <= 60 ? 3 : 4;
      stayDistribution.data[bucket] += 1;
    });

    const alerts = [];
    if (pendingAdoptions.length) {
      alerts.push({
        type: "amber",
        icon: "bi-heart-fill",
        title: pendingAdoptions.length + " pending adoption application(s)",
        desc: "Review newly submitted adoption applications.",
      });
    }
    if (pendingSurrenders.length) {
      alerts.push({
        type: "blue",
        icon: "bi-file-earmark-text-fill",
        title: pendingSurrenders.length + " pending surrender request(s)",
        desc: "Review surrender requests awaiting a decision.",
      });
    }
    if (lowStockItems.length) {
      alerts.push({
        type: "red",
        icon: "bi-box-seam-fill",
        title: lowStockItems.length + " low or critical inventory item(s)",
        desc:
          lowStockItems.filter((item) => item.level === "Critical").length +
          " currently at critical level.",
      });
    }
    const longStayCount = currentAnimals.filter(
      (animal) => daysSince(animal.intakeDate || animal.createdAt) > 60
    ).length;
    const yearlyIntakes = monthlyData.intake.reduce(
      (total, count) => total + count,
      0
    );
    const yearlyAdoptions = monthlyData.adoptions.reduce(
      (total, count) => total + count,
      0
    );
    if (longStayCount) {
      alerts.push({
        type: "red",
        icon: "bi-clock-fill",
        title: longStayCount + " animal(s) over 60 days",
        desc: "Long-stay animals may need priority review.",
      });
    }

    return res.json({
      totalPets: currentAnimals.length,
      intake: activeIntakes.length,
      profiling: countStatus("Profiling"),
      quarantine: countStatus("Quarantine"),
      readyForAdoption: countStatus("Ready"),
      adopted: countStatus("Adopted"),
      archived: countStatus("Archived"),
      pendingAdoptions: pendingAdoptions.length,
      pendingSurrenders: pendingSurrenders.length,
      monthlyData,
      species,
      stayDistribution,
      analytics: {
        currentPopulation: currentAnimals.length,
        yearlyIntakes,
        yearlyAdoptions,
        placementRate: yearlyIntakes
          ? Math.round((yearlyAdoptions / yearlyIntakes) * 100)
          : 0,
        readyRate: currentAnimals.length
          ? Math.round((countStatus("Ready") / currentAnimals.length) * 100)
          : 0,
        longStayCount,
        longStayRate: currentAnimals.length
          ? Math.round((longStayCount / currentAnimals.length) * 100)
          : 0,
        criticalStockCount: lowStockItems.filter((item) => item.level === "Critical").length,
        pendingAssessments: currentAnimals.filter((animal) => !animal.behavioralAssessment).length,
      },
      lowStockItems,
      alerts,
      recentAnimals: [...animals]
        .sort(
          (left, right) =>
            (toDate(right.createdAt)?.getTime() || 0) -
            (toDate(left.createdAt)?.getTime() || 0)
        )
        .slice(0, 10)
        .map((animal) => ({
          id: animal.id,
          label: buildShelterLabel(animal, animal.id),
          species: animal.species || "Unknown",
          breed: animal.breed || "Unknown",
          age: animal.ageEstimate || "Unknown",
          status: animal.status || "Profiling",
          days: daysSince(animal.intakeDate || animal.createdAt),
          assessmentComplete: Boolean(animal.behavioralAssessment),
        })),
      recentActivity: auditSnapshot.docs.map((document) => {
        const activity = document.data();
        return {
          id: activity.targetId || document.id,
          name:
            activity.targetName ||
            activity.targetId ||
            "System record",
          module: activity.module || "System",
          action: activity.action || "updated",
          staff:
            activity.performedByName ||
            activity.performedBy ||
            "System",
          date: toDate(activity.timestamp)?.toISOString() || "",
          status: activity.after?.status || activity.status || "Success",
        };
      }),
      pendingApplications: req.user.role === "Veterinarian" ? [] : pendingAdoptions.slice(0, 5).map(
        (application) => ({
          id: application.applicationId || application.id,
          animalId: application.pet_id || "",
          animal:
            application.pet_label ||
            application.pet_name ||
            "Shelter animal",
          applicant:
            application.applicant?.full_name ||
            "Applicant",
          matchPercent:
            application.compatibility?.matchPercent ?? null,
        })
      ),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[getDashboardStats]", error);
    return res.status(500).json({
      message: "Failed to load live dashboard data.",
    });
  }
};
