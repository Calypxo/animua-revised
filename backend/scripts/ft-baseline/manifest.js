const {
  DEFAULT_QUESTIONS,
  buildQuestionSnapshot,
} = require("../../src/services/quizQuestionService");

const BASELINE_ID = "FT_BASELINE_V1";
const LEDGER_PATH = `ftRunLedgers/${BASELINE_ID}`;
const REGISTRATION_TEST_ID = "FT_REGISTRATION_ACCOUNT";
const SYNTHETIC_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const USER_DEFINITIONS = [
  ["FT_CLIENT_ACTIVE", "Public", "Active", true],
  ["FT_CLIENT_UNVERIFIED", "Public", "Active", false],
  ["FT_CLIENT_INACTIVE", "Public", "Inactive", true],
  ["FT_CLIENT_PROFILE_MUTABLE", "Public", "Active", true],
  ["FT_CLIENT_NOTIFICATIONS", "Public", "Active", true],
  ["FT_CLIENT_QUIZ_NEW", "Public", "Active", true],
  ["FT_CLIENT_QUIZ_COOLDOWN", "Public", "Active", true],
  ["FT_CLIENT_QUIZ_ELIGIBLE", "Public", "Active", true],
  ["FT_ADMIN_ACTIVE", "Admin", "Active", true],
  ["FT_STAFF_ACTIVE", "Staff", "Active", true],
  ["FT_VET_ACTIVE", "Veterinarian", "Active", true],
  ["FT_MANAGEMENT_INACTIVE", "Staff", "Inactive", true],
  ["FT_MANAGEMENT_PROFILE_MUTABLE", "Staff", "Active", true],
];

const ANIMAL_IDS = [
  "FT_ANIMAL_READY_DOG", "FT_ANIMAL_READY_CAT", "FT_ANIMAL_PROFILING",
  "FT_ANIMAL_PROFILE_EDIT", "FT_ANIMAL_QUARANTINE_EMPTY",
  "FT_ANIMAL_QUARANTINE_ASSESSED", "FT_ANIMAL_QUARANTINE_CLEARED",
  "FT_ANIMAL_MEDICAL_HISTORY", "FT_ANIMAL_READY_FINALIZE", "FT_ANIMAL_ADOPTED",
  "FT_ANIMAL_ARCHIVE_CANDIDATE", "FT_ANIMAL_ARCHIVED", "FT_ANIMAL_HISTORY",
];

const ADOPTION_IDS = [
  "FT_ADOPTION_PENDING", "FT_ADOPTION_APPROVE_CANDIDATE",
  "FT_ADOPTION_REJECT_CANDIDATE", "FT_ADOPTION_APPROVED",
  "FT_ADOPTION_SCHEDULED", "FT_ADOPTION_RESCHEDULE_PENDING",
  "FT_ADOPTION_REJECTED", "FT_ADOPTION_EXPIRED",
  "FT_ADOPTION_FINALIZE_BLOCKED", "FT_ADOPTION_FINALIZE_ELIGIBLE",
];

const SURRENDER_IDS = [
  "FT_SURRENDER_PENDING", "FT_SURRENDER_APPROVE_CANDIDATE",
  "FT_SURRENDER_REJECT_CANDIDATE", "FT_SURRENDER_APPROVED",
  "FT_SURRENDER_SCHEDULED", "FT_SURRENDER_RESCHEDULE_PENDING",
  "FT_SURRENDER_REJECTED", "FT_SURRENDER_EXPIRED",
  "FT_SURRENDER_INTAKE_ELIGIBLE", "FT_SURRENDER_CONVERTED",
];

const INTAKE_IDS = [
  "FT_INTAKE_RESCUE_DRAFT", "FT_INTAKE_BARANGAY_DRAFT", "FT_INTAKE_PENDING",
  "FT_INTAKE_APPROVE_CANDIDATE", "FT_INTAKE_REJECT_CANDIDATE",
  "FT_INTAKE_APPROVED", "FT_INTAKE_CONVERT_CANDIDATE", "FT_INTAKE_CONVERTED",
];

const INVENTORY_IDS = [
  "FT_TEST_MEDICINE_01", "FT_TEST_ZERO", "FT_TEST_LOW", "FT_TEST_CRITICAL",
  "FT_TEST_STOCKOUT", "FT_TEST_BATCH_IN_01", "FT_TEST_BATCH_IN_02",
  "FT_TEST_BATCH_OUT_01", "FT_TEST_BATCH_OUT_02", "FT_TEST_PREDICT_OK",
  "FT_TEST_PREDICT_UNAVAILABLE", "FT_TEST_ITEM_MUTABLE",
];

function clean(value) {
  return String(value || "").trim();
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400000);
}

function iso(date) {
  return date.toISOString();
}

function dateOnly(date) {
  return iso(date).slice(0, 10);
}

function marker(testId) {
  return { testData: true, testId, testBaseline: BASELINE_ID };
}

function document(collection, id, data) {
  return { collection, id, path: `${collection}/${id}`, data: { ...data, ...marker(data.testId || id) } };
}

function requiredEnvironment(env, name) {
  const value = clean(env[name]);
  if (!value || /^<.+>$/.test(value)) {
    const error = new Error(`FT baseline environment value ${name} is required.`);
    error.code = "FT_BASELINE_ENV_MISSING";
    throw error;
  }
  return value;
}

function userEmailVariable(testId) {
  return `${testId}_EMAIL`;
}

function validateTestEmail(value, name) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`FT baseline environment value ${name} must be a valid dedicated test email.`);
  }
  return email;
}

function makeUsers(env, resetAt) {
  const publicPassword = requiredEnvironment(env, "FT_PUBLIC_PASSWORD");
  const managementPassword = requiredEnvironment(env, "FT_MANAGEMENT_PASSWORD");
  return USER_DEFINITIONS.map(([testId, role, status, emailVerified]) => {
    const emailName = userEmailVariable(testId);
    const email = validateTestEmail(requiredEnvironment(env, emailName), emailName);
    const displayName = testId.split("_").slice(1).map((part) => part[0] + part.slice(1).toLowerCase()).join(" ");
    const password = role === "Public" ? publicPassword : managementPassword;
    return {
      testId,
      uid: `${testId.toLowerCase().replace(/_/g, "-")}-v1`,
      email,
      password,
      auth: {
        email,
        displayName,
        emailVerified,
        disabled: status !== "Active",
      },
      claims: marker(testId),
      firestore: document("users", email, {
        testId,
        fullName: displayName,
        firstName: displayName.split(" ")[0],
        lastName: displayName.split(" ").slice(1).join(" "),
        phone: "09170000000",
        email,
        role,
        status,
        emailVerified,
        phoneVerified: false,
        termsAccepted: true,
        termsAcceptedAt: resetAt,
        policyVersion: "1.0",
        permissions: [],
        preferredLanguage: "English",
        notificationPreference: "Email and push notifications",
        notificationSettings: {
          applicationUpdates: true,
          surrenderRequestUpdates: true,
          announcementsEvents: true,
        },
        privacyPreference: "Standard privacy",
        profilePhotoDataUrl: "",
        createdAt: resetAt,
        updatedAt: resetAt,
      }),
    };
  });
}

const behavior = Object.fromEntries([
  "energyLevel", "exerciseNeeds", "independenceLevel", "attentionNeeds",
  "playfulness", "friendlinessToHumans", "goodWithKids", "goodWithOtherPets",
  "strangerTolerance", "noiseLevel", "spaceNeeds", "adaptability",
  "trainingDifficulty", "affectionLevel", "separationAnxiety", "aggressive",
  "specialNeeds",
].map((key) => [key, key === "aggressive" ? 1 : 3]));

function makeAnimal(id, index, resetAt) {
  const species = id.includes("CAT") ? "Cat" : "Dog";
  let status = "Profiling";
  if (id.includes("READY") || id === "FT_ANIMAL_HISTORY" || id === "FT_ANIMAL_ARCHIVE_CANDIDATE") status = "Ready";
  if (id.includes("QUARANTINE") || id === "FT_ANIMAL_MEDICAL_HISTORY") status = "Quarantine";
  if (id === "FT_ANIMAL_ADOPTED") status = "Adopted";
  if (id === "FT_ANIMAL_ARCHIVED") status = "Archived";
  const assessed = id.includes("ASSESSED") || id.includes("CLEARED") || id.includes("READY") || id === "FT_ANIMAL_MEDICAL_HISTORY";
  const cleared = id.includes("CLEARED");
  const medicalHistory = id === "FT_ANIMAL_MEDICAL_HISTORY";
  const medicalRecords = [];
  if (medicalHistory) {
    medicalRecords.push({ id: "FT_MR_CHECKUP", type: "Checkup", date: dateOnly(addDays(resetAt, -5)), vet: "FT Vet Active", diagnosis: "Routine FT examination", treatment: "Observation", notes: "Synthetic test record", clearance: "Pending", weight: 12, inventoryItemId: "", quantityUsed: 0 });
  }
  if (cleared) {
    medicalRecords.push({ id: "FT_MR_CLEARANCE", type: "Quarantine Clearance", date: dateOnly(addDays(resetAt, -1)), vet: "FT Vet Active", diagnosis: "", treatment: "", notes: "Synthetic clearance", clearance: "Cleared", weight: null, inventoryItemId: "", quantityUsed: 0 });
  }
  const data = {
    animalId: id,
    shelterLabel: `FT ${species} ${String(index + 1).padStart(2, "0")}`,
    identifyingDescription: `Synthetic ${species.toLowerCase()} for ${id}`,
    name: "",
    adoptedName: id === "FT_ANIMAL_ADOPTED" ? "FT Home Pet" : "",
    previousName: "",
    species,
    breed: species === "Cat" ? "Domestic Shorthair" : "Mixed Breed",
    sex: index % 2 ? "Female" : "Male",
    ageEstimate: "Adult",
    color: index % 2 ? "Brown and white" : "Black and white",
    weight: species === "Cat" ? 4.2 : 12.5,
    cageNumber: `FT-CAGE-${String(index + 1).padStart(2, "0")}`,
    housingType: "Shelter Cage",
    source: "Rescue",
    intakeDate: dateOnly(addDays(resetAt, -30)),
    intakeLocation: "FT Test Location, Angeles City",
    status,
    currentStage: status.toLowerCase(),
    photoURL: "",
    photoPath: "",
    behavioralAssessment: assessed ? behavior : null,
    behavioralNotes: assessed ? "Synthetic FT behavioral assessment" : "",
    behavioralAssessor: assessed ? "FT Vet Active" : "",
    behavioralDate: assessed ? dateOnly(addDays(resetAt, -2)) : "",
    compatibilityVector: assessed ? Object.values(behavior) : [],
    medicalRecords,
    quarantineClearance: cleared ? "Cleared" : "Pending",
    quarantineClearedAt: cleared ? dateOnly(addDays(resetAt, -1)) : "",
    adoptionDate: id === "FT_ANIMAL_ADOPTED" ? dateOnly(addDays(resetAt, -10)) : "",
    adopterName: id === "FT_ANIMAL_ADOPTED" ? "FT Client Active" : "",
    history: [{ date: dateOnly(addDays(resetAt, -30)), event: "Intake recorded", detail: "Synthetic FT baseline", actor: "FT Staff Active" }],
    notes: "Dedicated Functionality Testing data",
    createdAt: addDays(resetAt, -30),
    updatedAt: resetAt,
    createdBy: "ft-baseline@animua.test",
    updatedBy: "ft-baseline@animua.test",
  };
  if (id === "FT_ANIMAL_ARCHIVED") Object.assign(data, {
    statusBeforeArchive: "Ready",
    archiveReason: "Other",
    archiveDescription: "Synthetic archived baseline",
    archivedAt: addDays(resetAt, -2),
    archivedBy: "ft-admin@animua.test",
    archivedByName: "FT Admin Active",
  });
  if (id === "FT_ANIMAL_HISTORY") data.history.push({ date: dateOnly(addDays(resetAt, -1)), event: "Profile updated", detail: "FT history example", actor: "FT Staff Active" });
  return document("animals", id, { ...data, testId: id });
}

function deadlineFields(resetAt, offset = 0) {
  const approvedAt = addDays(resetAt, offset);
  return {
    approvedAt: iso(approvedAt),
    attendanceDeadlineAt: iso(addDays(approvedAt, 14)),
    deadlineDays: 14,
    deadlineStatus: "Awaiting Appointment",
    deadlineReminderStage: "Approved",
    noShowRisk: false,
    arrivalConfirmedAt: null,
    expiredAt: null,
    expirationReason: null,
  };
}

function makeAdoption(id, index, resetAt, clientEmail) {
  const animalMap = {
    FT_ADOPTION_FINALIZE_ELIGIBLE: "FT_ANIMAL_READY_FINALIZE",
    FT_ADOPTION_FINALIZE_BLOCKED: "FT_ANIMAL_READY_DOG",
    FT_ADOPTION_REJECT_CANDIDATE: "FT_ANIMAL_READY_CAT",
  };
  const petId = animalMap[id] || (index % 2 ? "FT_ANIMAL_READY_CAT" : "FT_ANIMAL_READY_DOG");
  let status = "Pending";
  if (["FT_ADOPTION_APPROVED", "FT_ADOPTION_SCHEDULED", "FT_ADOPTION_RESCHEDULE_PENDING", "FT_ADOPTION_FINALIZE_BLOCKED", "FT_ADOPTION_FINALIZE_ELIGIBLE"].includes(id)) status = "Approved";
  if (id === "FT_ADOPTION_REJECTED") status = "Rejected";
  if (id === "FT_ADOPTION_EXPIRED") status = "Expired";
  const data = {
    applicationId: `FT-APP-${String(index + 1).padStart(3, "0")}`,
    applicationYear: resetAt.getUTCFullYear(),
    pet_id: petId,
    pet_name: petId,
    pet_label: petId,
    selected_pet: { id: petId, name: petId, requestedName: "", age: "Adult", sex: "", type: "", status: "Ready" },
    compatibility: null,
    applicant: { full_name: "FT Client Active", email: clientEmail, age: "30", birthdate: "1996-01-01", address: "FT Address, Angeles City", civil_status: "Single", gender: "", citizenship: "Filipino", contact_number: "09170000000", occupation: "FT Tester", spouse_name: "", children_names: "" },
    other_information: { why_adopt: "Synthetic FT application", visit_veterinarian: "Yes", existing_pets: "None" },
    household_information: { housing_type: "House", residence_allows_pets: "Yes" },
    adoption_readiness: { why_adopt: "Synthetic FT application", primary_caregiver: "Applicant", provide_vet_care: "Yes", provide_daily_care: "Yes" },
    declaration: { signature_name: "FT Client Active", confirm_truthful: true, agree_declaration: true, understand_no_guarantee: true },
    identity_verification: { front: SYNTHETIC_IMAGE_DATA_URL, back: SYNTHETIC_IMAGE_DATA_URL, privacy_notice: "FT synthetic record" },
    account: { email: clientEmail, name: "FT Client Active", role: "Public" },
    status,
    rejectedReason: status === "Rejected" ? "Synthetic FT rejection" : "",
    approvedBy: status === "Approved" ? "ft-admin@animua.test" : "",
    adoptionDate: "",
    processedBy: "",
    pickupSchedule: null,
    pickupRescheduleRequest: null,
    submittedAt: addDays(resetAt, -5),
    updatedAt: resetAt,
    ...marker(id),
  };
  if (status === "Approved") Object.assign(data, deadlineFields(resetAt, -1));
  if (id === "FT_ADOPTION_SCHEDULED" || id === "FT_ADOPTION_RESCHEDULE_PENDING") {
    data.pickupSchedule = { date: dateOnly(addDays(resetAt, 2)), time: "10:00 AM", location: "Angeles City Veterinary Office, Brgy. Pampang, Angeles City", scheduledAt: iso(resetAt) };
    data.deadlineStatus = "Appointment Scheduled";
  }
  if (id === "FT_ADOPTION_RESCHEDULE_PENDING") {
    data.pickupRescheduleRequest = { date: dateOnly(addDays(resetAt, 3)), time: "11:00 AM", location: data.pickupSchedule.location, status: "Pending", requestedAt: iso(resetAt), requestedBy: clientEmail, previousSchedule: data.pickupSchedule };
    data.deadlineStatus = "Reschedule Pending";
  }
  if (id === "FT_ADOPTION_EXPIRED") Object.assign(data, { ...deadlineFields(resetAt, -20), status: "Expired", deadlineStatus: "Expired — No Show", deadlineReminderStage: "Expired", noShowRisk: true, expiredAt: iso(addDays(resetAt, -5)), expirationReason: "Synthetic expired baseline" });
  if (id === "FT_ADOPTION_FINALIZE_ELIGIBLE") data.arrivalConfirmedAt = iso(resetAt);
  return document("adoptions", id, data);
}

function makeSurrender(id, index, resetAt, clientEmail) {
  let status = "Pending";
  if (["FT_SURRENDER_APPROVED", "FT_SURRENDER_SCHEDULED", "FT_SURRENDER_RESCHEDULE_PENDING", "FT_SURRENDER_INTAKE_ELIGIBLE"].includes(id)) status = "Approved";
  if (id === "FT_SURRENDER_REJECTED") status = "Rejected";
  if (id === "FT_SURRENDER_EXPIRED") status = "Expired";
  if (id === "FT_SURRENDER_CONVERTED") status = "Converted";
  const data = {
    id,
    account: { email: clientEmail, name: "FT Client Active", role: "Public" },
    owner: {
      name: "FT Client Active",
      email: clientEmail,
      contact: "09170000000",
      address: "FT Address",
      barangay: "Pampang",
      city: "Angeles City",
      isAngelesResident: true,
      identityDocuments: {
        front: { name: "ft-id-front.png", type: "image/png", size: 68, dataUrl: SYNTHETIC_IMAGE_DATA_URL },
        back: { name: "ft-id-back.png", type: "image/png", size: 68, dataUrl: SYNTHETIC_IMAGE_DATA_URL },
      },
    },
    pet: { name: `FT Surrender Pet ${index + 1}`, species: index % 2 ? "Cat" : "Dog", breed: "Mixed Breed", age: "Adult", sex: index % 2 ? "Female" : "Male", colorMarkings: "Synthetic markings", status: [], vaccinationHistory: "Unknown", photoName: "", photoType: "", photoDataUrl: "" },
    surrenderReason: "Synthetic Functionality Testing surrender reason.",
    agreement: { agreedToTerms: true, agreedAt: iso(addDays(resetAt, -5)), agreementText: "FT agreement" },
    nlp: {
      sentiment: "Neutral",
      confidence: 1,
      urgencyLabel: id.includes("APPROVE") ? "High" : "Low",
      urgencyScore: id.includes("APPROVE") ? 75 : 25,
      reasons: ["Synthetic Functionality Testing record"],
      keywords: [],
      priority: id.includes("APPROVE") ? "High Priority" : "Normal Priority",
      source: "ft-baseline",
    },
    status,
    source: "Public Form",
    submittedAt: dateOnly(addDays(resetAt, -5)),
    createdAt: iso(addDays(resetAt, -5)),
    updatedAt: iso(resetAt),
    reviewedBy: status !== "Pending" ? "FT Staff Active" : null,
    reviewedAt: status !== "Pending" ? dateOnly(addDays(resetAt, -1)) : null,
    reviewNotes: null,
    rejectedReason: status === "Rejected" ? "Synthetic FT rejection" : null,
    intakeId: status === "Converted" ? "FT_INTAKE_CONVERTED" : null,
    dropoffDate: null,
    ...marker(id),
  };
  if (status === "Approved") Object.assign(data, deadlineFields(resetAt, -1));
  if (id === "FT_SURRENDER_SCHEDULED" || id === "FT_SURRENDER_RESCHEDULE_PENDING") {
    data.surrenderAppointment = { date: dateOnly(addDays(resetAt, 2)), time: "1:00 PM", location: "Angeles City Veterinary Office, Brgy. Pampang, Angeles City", scheduledAt: iso(resetAt) };
    data.dropoffDate = data.surrenderAppointment.date;
    data.deadlineStatus = "Appointment Scheduled";
  }
  if (id === "FT_SURRENDER_RESCHEDULE_PENDING") {
    data.surrenderRescheduleRequest = { date: dateOnly(addDays(resetAt, 3)), time: "2:00 PM", location: data.surrenderAppointment.location, status: "Pending", requestedAt: iso(resetAt), requestedBy: clientEmail, previousSchedule: data.surrenderAppointment };
    data.deadlineStatus = "Reschedule Pending";
  }
  if (id === "FT_SURRENDER_EXPIRED") Object.assign(data, { ...deadlineFields(resetAt, -20), status: "Expired", deadlineStatus: "Expired — No Show", deadlineReminderStage: "Expired", noShowRisk: true, expiredAt: iso(addDays(resetAt, -5)), expirationReason: "Synthetic expired baseline" });
  if (id === "FT_SURRENDER_INTAKE_ELIGIBLE") data.arrivalConfirmedAt = iso(resetAt);
  if (id === "FT_SURRENDER_CONVERTED") Object.assign(data, { deadlineStatus: "Completed", deadlineReminderStage: "Completed", noShowRisk: false, convertedAt: iso(resetAt), convertedBy: "FT Staff Active" });
  return document("surrenderRequests", id, data);
}

function makeIntake(id, index, resetAt) {
  const draft = id.includes("DRAFT");
  let status = draft ? "Draft" : "Pending";
  if (id === "FT_INTAKE_APPROVED" || id === "FT_INTAKE_CONVERT_CANDIDATE") status = "Approved";
  if (id === "FT_INTAKE_CONVERTED") status = "Converted";
  const source = id.includes("BARANGAY") ? "Barangay Impound" : "Rescue";
  return document("intakeRecords", id, {
    testId: id,
    animalName: "",
    identifyingDescription: `Synthetic intake animal ${index + 1}`,
    previousName: "",
    species: index % 2 ? "Cat" : "Dog",
    breed: "Mixed Breed",
    sex: index % 2 ? "Female" : "Male",
    ageEstimate: "Adult",
    color: "Brown and white",
    source,
    condition: "Stable",
    weight: index % 2 ? 4.5 : 13,
    conditionNotes: "Synthetic FT intake condition",
    injuries: "None observed",
    vaccinated: "Unknown",
    alteredStatus: "Unknown",
    visibleDefects: "None observed",
    intakeDate: dateOnly(addDays(resetAt, -1)),
    location: "FT Intake Location, Angeles City",
    intakeNotes: "Dedicated Functionality Testing record",
    barangayDetails: source === "Barangay Impound" ? { barangayName: "Pampang", officerName: "FT Officer", contactNumber: "09170000000" } : null,
    surrenderRefId: null,
    ownerName: "",
    ownerContact: "",
    surrenderApprovedDate: "",
    status,
    intakeYear: resetAt.getUTCFullYear(),
    encodedBy: "FT Staff Active",
    encodedByEmail: "ft-staff@animua.test",
    approvedBy: status === "Approved" || status === "Converted" ? "FT Staff Active" : null,
    approvedAt: status === "Approved" || status === "Converted" ? dateOnly(resetAt) : null,
    rejectedReason: null,
    animalProfileId: status === "Converted" ? "FT_ANIMAL_PROFILING" : null,
    createdAt: addDays(resetAt, -1),
    updatedAt: resetAt,
  });
}

const INVENTORY_STOCK = [100, 0, 5, 2, 50, 20, 20, 30, 30, 40, 10, 10];
function makeInventory(id, index, resetAt) {
  const currentStock = INVENTORY_STOCK[index];
  const data = {
    testId: id,
    id,
    name: `FT Inventory Item ${String(index + 1).padStart(2, "0")}`,
    itemDescription: `Synthetic item ${id}`,
    category: id.includes("MEDICINE") ? "Antibiotic" : "Consumable",
    unit: "pcs",
    currentStock,
    averageInventory: Math.max(currentStock, 20),
    avgMonthlyUsage: 10,
    recencyDays: 2,
    leadTimeDays: 5,
    stockoutFrequency: 0,
    monthlyTurnoverRatio: 0.5,
    reorderPoint: 10,
    stockStatus: currentStock <= 2 ? "Critical" : currentStock <= 5 ? "Low" : "OK",
    createdBy: "FT Staff Active",
    createdByEmail: "ft-staff@animua.test",
    updatedBy: "FT Staff Active",
    updatedByEmail: "ft-staff@animua.test",
    createdAt: resetAt,
    updatedAt: resetAt,
  };
  if (id === "FT_TEST_PREDICT_UNAVAILABLE") {
    delete data.avgMonthlyUsage;
    delete data.monthlyTurnoverRatio;
  }
  return document("inventoryItems", id, data);
}

function makeSupportingDocuments(resetAt, users) {
  const byId = Object.fromEntries(users.map((user) => [user.testId, user]));
  const clientEmail = byId.FT_CLIENT_ACTIVE.email;
  const cooldownEmail = byId.FT_CLIENT_QUIZ_COOLDOWN.email;
  const eligibleEmail = byId.FT_CLIENT_QUIZ_ELIGIBLE.email;
  const savedPreferences = Object.fromEntries(
    DEFAULT_QUESTIONS.map((question) => [question.traitKey, 3])
  );
  const savedFilters = {
    preferredSpecies: "Any",
    preferredSex: "Any",
    needAllergyFriendly: "no",
    acceptSpecialNeeds: "yes",
  };
  const savedQuestionSnapshot = buildQuestionSnapshot(
    DEFAULT_QUESTIONS,
    savedPreferences
  );
  const savedMatches = [
    {
      animalId: "FT_ANIMAL_READY_DOG",
      animalName: "Synthetic dog for FT_ANIMAL_READY_DOG",
      compatibilityScore: 100,
      compatibilityPercent: 100,
    },
    {
      animalId: "FT_ANIMAL_READY_CAT",
      animalName: "Synthetic cat for FT_ANIMAL_READY_CAT",
      compatibilityScore: 100,
      compatibilityPercent: 100,
    },
  ];
  return [
    document("surrenderSettings", "requestAvailability", { testId: "FT_SURRENDER_AVAILABILITY", acceptingRequests: true, updatedAt: iso(resetAt), updatedBy: { email: "ft-admin@animua.test", name: "FT Admin Active", role: "Admin" } }),
    document("announcements", "FT_ANNOUNCEMENT_PUBLISHED", { testId: "FT_ANNOUNCEMENT_PUBLISHED", title: "FT Published Announcement", type: "News & Article", caption: "Synthetic public announcement", status: "Published", visibleToPublic: true, imagePath: "", imageUrl: "", createdAt: addDays(resetAt, -2), updatedAt: resetAt, createdBy: "ft-staff@animua.test", createdByName: "FT Staff Active", createdByRole: "Staff" }),
    document("announcements", "FT_ANNOUNCEMENT_DRAFT", { testId: "FT_ANNOUNCEMENT_DRAFT", title: "FT Draft Announcement", type: "Upcoming Events", caption: "Synthetic private draft", status: "Draft", visibleToPublic: false, eventDate: dateOnly(addDays(resetAt, 7)), imagePath: "", imageUrl: "", createdAt: addDays(resetAt, -1), updatedAt: resetAt, createdBy: "ft-staff@animua.test", createdByName: "FT Staff Active", createdByRole: "Staff" }),
    document("events", "FT_EVENT_PUBLIC", { testId: "FT_EVENT_PUBLIC", title: "FT Public Event", type: "Event", status: "Published", published: true, isPublic: true, eventDate: dateOnly(addDays(resetAt, 7)), eventTime: "9:00 AM", location: "FT Test Venue", description: "Synthetic event", createdAt: resetAt, updatedAt: resetAt }),
    document("contactMessages", "FT_CONTACT_NEW", { testId: "FT_CONTACT_NEW", userId: clientEmail, fullName: "FT Client Active", email: clientEmail, subject: "FT New Inquiry", message: "Synthetic inquiry", messages: [{ sender: "user", name: "FT Client Active", message: "Synthetic inquiry", createdAt: iso(addDays(resetAt, -1)) }], status: "New", source: "Contact Us Page", notificationStatus: "Not configured", createdAt: iso(addDays(resetAt, -1)) }),
    document("contactMessages", "FT_CONTACT_REPLIED", { testId: "FT_CONTACT_REPLIED", userId: clientEmail, fullName: "FT Client Active", email: clientEmail, subject: "FT Replied Inquiry", message: "Synthetic inquiry", messages: [{ sender: "user", name: "FT Client Active", message: "Synthetic inquiry", createdAt: iso(addDays(resetAt, -2)) }, { sender: "staff", name: "FT Staff Active", message: "Synthetic reply", createdAt: iso(addDays(resetAt, -1)) }], status: "Replied", source: "Contact Us Page", replyMessage: "Synthetic reply", repliedBy: "ft-staff@animua.test", repliedAt: iso(addDays(resetAt, -1)), createdAt: iso(addDays(resetAt, -2)) }),
    document("notifications", "FT_NOTIFICATION_UNREAD", { testId: "FT_NOTIFICATION_UNREAD", userEmail: byId.FT_CLIENT_NOTIFICATIONS.email, category: "application", type: "ft_unread", title: "FT Unread Notification", message: "Synthetic unread notification", link: "/pages/public/my-submissions.html", referenceId: "FT_ADOPTION_PENDING", metadata: {}, read: false, createdAt: resetAt }),
    document("notifications", "FT_NOTIFICATION_READ", { testId: "FT_NOTIFICATION_READ", userEmail: byId.FT_CLIENT_NOTIFICATIONS.email, category: "event", type: "ft_read", title: "FT Read Notification", message: "Synthetic read notification", link: "/pages/public/announcements.html", referenceId: "FT_EVENT_PUBLIC", metadata: {}, read: true, readAt: resetAt, createdAt: addDays(resetAt, -1) }),
    document("compatibilityResults", "FT_QUIZ_RESULT_COOLDOWN", { testId: "FT_QUIZ_RESULT_COOLDOWN", resultId: "FT_QUIZ_RESULT_COOLDOWN", userId: cooldownEmail, userEmail: cooldownEmail, userName: "FT Client Quiz Cooldown", preferences: savedPreferences, filters: savedFilters, questionSnapshot: savedQuestionSnapshot, matches: savedMatches, quizVersion: 1, completedAt: resetAt, nextRetakeAt: addDays(resetAt, 7), isLatest: true }),
    document("compatibilityResults", "FT_QUIZ_RESULT_ELIGIBLE", { testId: "FT_QUIZ_RESULT_ELIGIBLE", resultId: "FT_QUIZ_RESULT_ELIGIBLE", userId: eligibleEmail, userEmail: eligibleEmail, userName: "FT Client Quiz Eligible", preferences: {}, filters: {}, questionSnapshot: [], matches: [], quizVersion: 1, completedAt: addDays(resetAt, -40), nextRetakeAt: addDays(resetAt, -10), isLatest: true }),
    document("quizSettings", "compatibilityQuiz", { testId: "FT_QUIZ_SETTINGS", quizEnabled: true, retakeCooldownDays: 30, quizVersion: 1, updatedAt: resetAt, updatedBy: "ft-admin@animua.test" }),
    document("quizQuestionConfigs", "compatibilityQuiz", { testId: "FT_QUIZ_QUESTION_CONFIG", questions: DEFAULT_QUESTIONS, version: 1, updatedAt: resetAt, updatedBy: { email: "ft-admin@animua.test", name: "FT Admin Active" } }),
    document("auditLogs", "FT_AUDIT_LOGIN", { testId: "FT_AUDIT_LOGIN", action: "auth.login", module: "Authentication", targetId: clientEmail, targetName: "FT Client Active", performedBy: clientEmail, performedByName: "FT Client Active", role: "Public", before: {}, after: {}, status: "Success", timestamp: addDays(resetAt, -1) }),
    document("auditLogs", "FT_AUDIT_ANIMAL", { testId: "FT_AUDIT_ANIMAL", action: "animal.updated", module: "Animal Profiling", targetId: "FT_ANIMAL_PROFILE_EDIT", targetName: "FT Profile Edit Animal", performedBy: "ft-staff@animua.test", performedByName: "FT Staff Active", role: "Staff", before: { status: "Profiling" }, after: { status: "Profiling" }, status: "Success", timestamp: resetAt }),
    document("ftRunLedgers", BASELINE_ID, { testId: "FT_RUN_LEDGER", baseline: BASELINE_ID, generatedFirestorePaths: [], generatedAuthEmails: [], generatedStoragePaths: [], updatedAt: resetAt }),
  ];
}

function buildManifest({ env = process.env, now = new Date() } = {}) {
  const resetAt = new Date(now);
  if (Number.isNaN(resetAt.getTime())) throw new Error("A valid reset timestamp is required.");
  const users = makeUsers(env, resetAt);
  const byId = Object.fromEntries(users.map((user) => [user.testId, user]));
  const clientEmail = byId.FT_CLIENT_ACTIVE.email;
  const documents = [
    ...users.map((user) => user.firestore),
    ...ANIMAL_IDS.map((id, index) => makeAnimal(id, index, resetAt)),
    ...ADOPTION_IDS.map((id, index) => makeAdoption(id, index, resetAt, clientEmail)),
    ...SURRENDER_IDS.map((id, index) => makeSurrender(id, index, resetAt, clientEmail)),
    ...INTAKE_IDS.map((id, index) => makeIntake(id, index, resetAt)),
    ...INVENTORY_IDS.map((id, index) => makeInventory(id, index, resetAt)),
    ...makeSupportingDocuments(resetAt, users),
  ];
  const duplicate = documents.find((entry, index) => documents.findIndex((other) => other.path === entry.path) !== index);
  if (duplicate) throw new Error(`Duplicate FT manifest document path: ${duplicate.path}`);

  const registrationEmail = validateTestEmail(
    requiredEnvironment(env, "FT_REGISTRATION_ACCOUNT_EMAIL"),
    "FT_REGISTRATION_ACCOUNT_EMAIL"
  );
  const userEmails = users.map((user) => user.email);
  if (new Set(userEmails).size !== userEmails.length) {
    throw new Error("Every FT baseline account must use a unique email address.");
  }
  if (userEmails.includes(registrationEmail)) {
    throw new Error("FT_REGISTRATION_ACCOUNT_EMAIL must not match a baseline account.");
  }
  const transientCleanupDocuments = [
    {
      testId: "FT_CLIENT_UNVERIFIED_EMAIL_OTP",
      collection: "emailVerificationOtps",
      id: byId.FT_CLIENT_UNVERIFIED.email,
      path: `emailVerificationOtps/${byId.FT_CLIENT_UNVERIFIED.email}`,
    },
    {
      testId: "FT_CLIENT_PROFILE_MUTABLE_PASSWORD_OTP",
      collection: "passwordChangeOtps",
      id: byId.FT_CLIENT_PROFILE_MUTABLE.email,
      path: `passwordChangeOtps/${byId.FT_CLIENT_PROFILE_MUTABLE.email}`,
    },
  ];
  return Object.freeze({
    baselineId: BASELINE_ID,
    resetAt,
    users,
    documents,
    registrationAccount: {
      testId: REGISTRATION_TEST_ID,
      email: registrationEmail,
      firestorePath: `users/${registrationEmail}`,
      otpFirestorePath: `emailVerificationOtps/${registrationEmail}`,
    },
    transientCleanupDocuments,
    ledgerPath: LEDGER_PATH,
    storage: {
      bucket: "animua-ft.firebasestorage.app",
      fixtureObjects: [
        { testId: "FT_ANIMAL_READY_DOG_IMAGE", path: "animals/FT_ANIMAL_READY_DOG/ft-profile.jpg", upload: false },
        { testId: "FT_ANNOUNCEMENT_PUBLISHED_IMAGE", path: "announcements/FT_ANNOUNCEMENT_PUBLISHED/ft-cover.jpg", upload: false },
      ],
      generatedObjectPolicies: [
        {
          testId: "IT_023_ANNOUNCEMENT_IMAGE",
          parentDocumentPath: "announcements/FT_ANNOUNCEMENT_DRAFT",
          pathPattern: /^announcements\/FT_ANNOUNCEMENT_DRAFT\/cover-\d{13}\.(?:jpg|png|webp)$/,
        },
        {
          testId: "FT_049_ANIMAL_PROFILE_IMAGE",
          parentDocumentPath: "animals/FT_ANIMAL_PROFILE_EDIT",
          pathPattern: /^animals\/FT_ANIMAL_PROFILE_EDIT\/profile-\d{13}\.png$/,
        },
      ],
    },
    generatedFirestorePolicy: {
      allowedCollections: ["adoptions", "surrenderRequests", "intakeRecords", "animals", "announcements", "contactMessages", "notifications", "auditLogs", "compatibilityResults", "inventoryItems"],
      documentIdPattern: /^(?:FT_RUN_[A-Za-z0-9_-]+|[A-Za-z0-9]{20}|QR-\d{4}-[A-F0-9]{8}|INT-\d{4}-\d{3,}|ANIM-\d{4}-\d{3,}|SR-\d{4}-\d+|ITM013X)$/,
      inventoryTransactionIdPattern: /^(?:FT_RUN_[A-Za-z0-9_-]+|[A-Za-z0-9]{20})$/,
    },
  });
}

function summarizeManifest(manifest) {
  const collections = {};
  for (const entry of manifest.documents) collections[entry.collection] = (collections[entry.collection] || 0) + 1;
  return { baselineId: manifest.baselineId, users: manifest.users.length, documents: manifest.documents.length, collections };
}

module.exports = {
  BASELINE_ID,
  LEDGER_PATH,
  REGISTRATION_TEST_ID,
  USER_DEFINITIONS,
  ANIMAL_IDS,
  ADOPTION_IDS,
  SURRENDER_IDS,
  INTAKE_IDS,
  INVENTORY_IDS,
  buildManifest,
  summarizeManifest,
};
