const { db } = require("../config/firebase");
const { buildShelterLabel } = require("../utils/animalIdentity");

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

    const currentAnimals = animals.filter(
      (animal) => !["Adopted", "Archived"].includes(animal.status)
    );
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
    if (longStayCount) {
      alerts.push({
        type: "red",
        icon: "bi-clock-fill",
        title: longStayCount + " animal(s) over 60 days",
        desc: "Long-stay animals may need priority review.",
      });
    }

    return res.json({
      totalPets: animals.length + activeIntakes.length,
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
