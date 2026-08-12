const crypto = require("crypto");
const { admin, db } = require("../config/firebase");
const { buildShelterLabel } = require("../utils/animalIdentity");
const { createManagementNotification } = require("../services/notificationService");
const {
  scoreMatches,
  applyFilters,
} = require("../services/compatibilityScoringService");
const {
  DEFAULT_QUESTIONS,
  validateAndNormalizeQuestions,
  validateConfiguredPreferences,
  buildQuestionSnapshot,
} = require("../services/quizQuestionService");

const RESULTS = "compatibilityResults";
const SETTINGS = db.collection("quizSettings").doc("compatibilityQuiz");
const QUESTION_CONFIG = db.collection("quizQuestionConfigs").doc("compatibilityQuiz");
const DEFAULTS = { quizEnabled: true, retakeCooldownDays: 30, quizVersion: 1 };
const FILTERS = { preferredSpecies: ["Any", "Dog", "Cat"], preferredSex: ["Any", "Male", "Female"], needAllergyFriendly: ["no", "yes"], acceptSpecialNeeds: ["yes", "no"] };

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.seconds === "number") return new Date(value.seconds * 1000);
  if (typeof value._seconds === "number") return new Date(value._seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function addDays(date, days) {
  if (!date || !Number.isInteger(days)) return null;
  return new Date(date.getTime() + days * 86400000);
}
function json(value) {
  if (value == null) return value ?? null;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(json);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "ref").map(([key, item]) => [key, json(item)]));
  return value;
}
function validate(body = {}, questions = DEFAULT_QUESTIONS) {
  const validated = validateConfiguredPreferences(body.preferences, questions);
  if (validated.error) return validated;
  const preferences = validated.preferences;
  const filters = {};
  for (const [key, allowed] of Object.entries(FILTERS)) {
    const value = body.filters?.[key] ?? allowed[0];
    if (!allowed.includes(value)) return { error: `Invalid ${key} filter.` };
    filters[key] = value;
  }
  return { preferences, scoringPreferences: validated.scoringPreferences, filters };
}
async function getSettings(tx) {
  const snap = tx ? await tx.get(SETTINGS) : await SETTINGS.get();
  const data = snap.exists ? snap.data() : {};
  return { quizEnabled: typeof data.quizEnabled === "boolean" ? data.quizEnabled : true, retakeCooldownDays: Number.isInteger(data.retakeCooldownDays) ? data.retakeCooldownDays : 30, quizVersion: Number.isInteger(data.quizVersion) ? data.quizVersion : 1, updatedAt: data.updatedAt || null, updatedBy: data.updatedBy || null };
}
async function getQuestionConfiguration() {
  const snap = await QUESTION_CONFIG.get();
  if (!snap.exists) return { questions: DEFAULT_QUESTIONS, persisted: false };
  const validated = validateAndNormalizeQuestions(snap.data().questions);
  if (validated.error) {
    console.error("[quizQuestionConfig] Stored configuration is invalid:", validated.error);
    return { questions: DEFAULT_QUESTIONS, persisted: false, recoveryReason: validated.error };
  }
  return {
    questions: validated.questions,
    persisted: true,
    updatedAt: snap.data().updatedAt || null,
    updatedBy: snap.data().updatedBy || null,
    version: snap.data().version || null,
  };
}
async function getResults(userId, tx) {
  const query = db.collection(RESULTS).where("userId", "==", userId);
  const snap = tx ? await tx.get(query) : await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, ref: doc.ref, ...doc.data() })).sort((a, b) => (toDate(b.completedAt)?.getTime() || 0) - (toDate(a.completedAt)?.getTime() || 0));
}
function eligibility(settings, user, results) {
  const latest = results.find((item) => item.isLatest) || results[0] || null;
  const fallbackRetakeAt = latest
    ? addDays(toDate(latest.completedAt), settings.retakeCooldownDays)
    : null;
  const allowedAt = toDate(user?.quizRetakeOverrideAt) || toDate(latest?.nextRetakeAt) || fallbackRetakeAt;
  const now = new Date();
  let canTakeQuiz = true;
  let reason = latest ? "RETAKE_AVAILABLE" : "FIRST_ATTEMPT";
  if (!settings.quizEnabled) { canTakeQuiz = false; reason = "QUIZ_DISABLED"; }
  else if (latest && allowedAt && now < allowedAt) { canTakeQuiz = false; reason = "RETAKE_COOLDOWN"; }
  return { canTakeQuiz, hasPreviousResult: Boolean(latest), reason, lastCompletedAt: toDate(latest?.completedAt)?.toISOString() || null, nextRetakeAt: allowedAt?.toISOString() || null, remainingDays: canTakeQuiz || !allowedAt ? 0 : Math.max(1, Math.ceil((allowedAt - now) / 86400000)), latestResult: latest ? json(latest) : null };
}
async function context(userId, tx) {
  const userRef = db.collection("users").doc(userId);
  const [settings, userSnap, results] = await Promise.all([getSettings(tx), tx ? tx.get(userRef) : userRef.get(), getResults(userId, tx)]);
  const user = userSnap.exists ? userSnap.data() : {};
  return { settings, user, results, eligibility: eligibility(settings, user, results) };
}
function blocked(info) {
  if (info.reason === "QUIZ_DISABLED") return "The compatibility quiz is temporarily unavailable.";
  const date = toDate(info.nextRetakeAt);
  return date ? `You can retake the compatibility quiz on ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" }).format(date)}.` : "You are not eligible to retake the compatibility quiz yet.";
}
function makeResultId() { return `QR-${new Date().getFullYear()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`; }

exports.getEligibility = async (req, res) => {
  try { return res.json((await context(req.user.id)).eligibility); }
  catch (error) { console.error("[getEligibility]", error); return res.status(500).json({ message: "Unable to check quiz eligibility." }); }
};
exports.getMyLatestResult = async (req, res) => {
  try { const list = await getResults(req.user.id); return res.json({ result: json(list.find((item) => item.isLatest) || list[0] || null) }); }
  catch (error) { console.error("[getMyLatestResult]", error); return res.status(500).json({ message: "Unable to load your compatibility result." }); }
};
exports.getMyResults = async (req, res) => {
  try { return res.json({ results: json(await getResults(req.user.id)) }); }
  catch (error) { console.error("[getMyResults]", error); return res.status(500).json({ message: "Unable to load your compatibility history." }); }
};

exports.matchPets = async (req, res) => {
  try {
    const questionConfig = await getQuestionConfiguration();
    const input = validate(req.body, questionConfig.questions);
    if (input.error) return res.status(400).json({ success: false, message: input.error });
    const beforeMatch = await context(req.user.id);
    if (!beforeMatch.eligibility.canTakeQuiz) return res.status(403).json({ success: false, message: blocked(beforeMatch.eligibility), eligibility: beforeMatch.eligibility });
    const snap = await db.collection("animals").get();
    let animals = snap.docs.map((doc) => { const data = doc.data(); const name = buildShelterLabel(data, doc.id); return { id: doc.id, ...data, name, displayLabel: name, shelterLabel: name, photoUrl: data.photoURL || data.photoUrl || "", age: data.ageEstimate || data.age || "" }; });
    animals = applyFilters(animals, input.filters);
    const scored = animals.length ? await scoreMatches(input.scoringPreferences, animals, 5) : { matches: [] };
    const saved = await db.runTransaction(async (tx) => {
      const current = await context(req.user.id, tx);
      if (!current.eligibility.canTakeQuiz) { const error = new Error("NOT_ELIGIBLE"); error.info = current.eligibility; throw error; }
      const completedAt = new Date();
      const nextRetakeAt = new Date(completedAt.getTime() + current.settings.retakeCooldownDays * 86400000);
      current.results.forEach((item) => tx.update(item.ref, { isLatest: false }));
      const id = makeResultId();
      tx.create(db.collection(RESULTS).doc(id), { resultId: id, userId: req.user.id, userEmail: req.user.email, userName: req.user.fullName || req.user.email, preferences: input.preferences, filters: input.filters, questionSnapshot: buildQuestionSnapshot(questionConfig.questions, input.preferences, req.body.answerSelections), matches: scored.matches.slice(0, 5).map((match) => ({ animalId: String(match.id || match.petId || ""), animalName: String(match.name || "Shelter animal"), compatibilityScore: Number(match.matchScore || 0), compatibilityPercent: Number(match.matchPercent || 0) })), quizVersion: current.settings.quizVersion, completedAt: admin.firestore.Timestamp.fromDate(completedAt), nextRetakeAt: admin.firestore.Timestamp.fromDate(nextRetakeAt), isLatest: true });
      tx.set(db.collection("users").doc(req.user.id), { quizRetakeOverrideAt: null }, { merge: true });
      return { id, completedAt, nextRetakeAt };
    });
    await createManagementNotification({
      roles: ["Admin", "Staff", "Veterinarian"],
      type: "compatibility_quiz_completed",
      resourceType: "compatibility_result",
      relatedResourceId: saved.id,
      title: "Compatibility quiz completed",
      message: `${req.user.fullName || req.user.email} completed the compatibility quiz.`,
    }).catch((notificationError) => console.warn("[matchPets notification]", notificationError.message));
    return res.json({ ...scored, success: true, resultId: saved.id, completedAt: saved.completedAt.toISOString(), nextRetakeAt: saved.nextRetakeAt.toISOString() });
  } catch (error) {
    if (error.message === "NOT_ELIGIBLE") return res.status(403).json({ success: false, message: blocked(error.info), eligibility: error.info });
    console.error("[matchPets]", error); return res.status(500).json({ success: false, message: "Failed to match pets." });
  }
};

async function audit(req, action, targetId, targetName, before, after) {
  await db.collection("auditLogs").add({ action, module: "Compatibility Quiz", targetId, targetName, performedBy: req.user.email, performedByName: req.user.fullName, role: req.user.role, before, after, status: "Success", timestamp: admin.firestore.FieldValue.serverTimestamp() });
}
exports.getAdminSettings = async (_req, res) => { try { return res.json({ settings: json(await getSettings()) }); } catch (error) { console.error("[getAdminSettings]", error); return res.status(500).json({ message: "Unable to load quiz settings." }); } };
exports.getQuizQuestions = async (_req, res) => {
  try {
    const config = await getQuestionConfiguration();
    return res.json({
      questions: json(config.questions.filter((question) => question.active)),
      version: config.version || (await getSettings()).quizVersion,
    });
  } catch (error) {
    console.error("[getQuizQuestions]", error);
    return res.status(500).json({ message: "Unable to load compatibility quiz questions." });
  }
};
exports.getAdminQuestions = async (_req, res) => {
  try {
    const [config, settings] = await Promise.all([getQuestionConfiguration(), getSettings()]);
    return res.json({ questions: json(config.questions), version: config.version || settings.quizVersion, persisted: config.persisted });
  } catch (error) {
    console.error("[getAdminQuestions]", error);
    return res.status(500).json({ message: "Unable to load quiz question configuration." });
  }
};
exports.replaceAdminQuestions = async (req, res) => {
  try {
    const validated = validateAndNormalizeQuestions(req.body?.questions);
    if (validated.error) return res.status(400).json({ message: validated.error });
    const [previousConfig, settings] = await Promise.all([getQuestionConfiguration(), getSettings()]);
    const version = settings.quizVersion + 1;
    const updatedBy = { id: req.user.id, email: req.user.email, name: req.user.fullName };
    const batch = db.batch();
    batch.set(QUESTION_CONFIG, {
      questions: validated.questions,
      version,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy,
    });
    batch.set(SETTINGS, {
      quizVersion: version,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy,
    }, { merge: true });
    await batch.commit();
    await audit(req, "compatibility.questions_updated", QUESTION_CONFIG.id, "Compatibility Quiz Questions", { version: settings.quizVersion, questionCount: previousConfig.questions.length }, { version, questionCount: validated.questions.length });
    return res.json({ message: "Quiz questions saved.", questions: validated.questions, version });
  } catch (error) {
    console.error("[replaceAdminQuestions]", error);
    return res.status(500).json({ message: "Unable to save quiz questions." });
  }
};
exports.updateAdminSettings = async (req, res) => {
  try {
    const previous = await getSettings(); const cooldown = Number(req.body.retakeCooldownDays); const version = Number(req.body.quizVersion ?? previous.quizVersion);
    if (typeof req.body.quizEnabled !== "boolean") return res.status(400).json({ message: "quizEnabled must be true or false." });
    if (!Number.isInteger(cooldown) || cooldown < 1 || cooldown > 365) return res.status(400).json({ message: "Cooldown must be a whole number from 1 to 365." });
    if (!Number.isInteger(version) || version < 1) return res.status(400).json({ message: "Quiz version must be a positive whole number." });
    const clean = { quizEnabled: req.body.quizEnabled, retakeCooldownDays: cooldown, quizVersion: version };
    await SETTINGS.set({ ...clean, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: { id: req.user.id, email: req.user.email, name: req.user.fullName } }, { merge: true });
    await audit(req, "compatibility.settings_updated", SETTINGS.id, "Compatibility Quiz Settings", { quizEnabled: previous.quizEnabled, retakeCooldownDays: previous.retakeCooldownDays, quizVersion: previous.quizVersion }, clean);
    return res.json({ message: "Quiz settings saved.", settings: clean });
  } catch (error) { console.error("[updateAdminSettings]", error); return res.status(500).json({ message: "Unable to save quiz settings." }); }
};
exports.getAdminResults = async (req, res) => {
  try { const snap = await db.collection(RESULTS).limit(Math.min(Number(req.query.limit) || 500, 1000)).get(); let list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a, b) => (toDate(b.completedAt)?.getTime() || 0) - (toDate(a.completedAt)?.getTime() || 0)); const search = String(req.query.search || "").toLowerCase(); if (search) list = list.filter((item) => `${item.userName} ${item.userEmail} ${item.resultId}`.toLowerCase().includes(search)); return res.json({ results: json(list), total: list.length }); }
  catch (error) { console.error("[getAdminResults]", error); return res.status(500).json({ message: "Unable to load quiz results." }); }
};
exports.getAdminResult = async (req, res) => { try { const snap = await db.collection(RESULTS).doc(req.params.resultId).get(); if (!snap.exists) return res.status(404).json({ message: "Quiz result not found." }); return res.json({ result: json({ id: snap.id, ...snap.data() }) }); } catch (error) { console.error("[getAdminResult]", error); return res.status(500).json({ message: "Unable to load the quiz result." }); } };
exports.setRetakeOverride = async (req, res) => {
  try { const ref = db.collection("users").doc(req.params.userId); const snap = await ref.get(); if (!snap.exists) return res.status(404).json({ message: "User not found." }); const date = req.body.immediate === true ? new Date() : toDate(req.body.retakeAt); if (!date) return res.status(400).json({ message: "A valid retake date is required." }); const old = json(snap.data().quizRetakeOverrideAt || null); await ref.set({ quizRetakeOverrideAt: admin.firestore.Timestamp.fromDate(date) }, { merge: true }); await audit(req, req.body.immediate === true ? "compatibility.immediate_retake_allowed" : "compatibility.retake_override_set", snap.id, snap.data().fullName || snap.id, { quizRetakeOverrideAt: old }, { quizRetakeOverrideAt: date.toISOString() }); return res.json({ message: "Retake date updated.", quizRetakeOverrideAt: date.toISOString() }); }
  catch (error) { console.error("[setRetakeOverride]", error); return res.status(500).json({ message: "Unable to update the retake date." }); }
};
exports.removeRetakeOverride = async (req, res) => {
  try { const ref = db.collection("users").doc(req.params.userId); const snap = await ref.get(); if (!snap.exists) return res.status(404).json({ message: "User not found." }); const old = json(snap.data().quizRetakeOverrideAt || null); await ref.set({ quizRetakeOverrideAt: null }, { merge: true }); await audit(req, "compatibility.retake_override_removed", snap.id, snap.data().fullName || snap.id, { quizRetakeOverrideAt: old }, { quizRetakeOverrideAt: null }); return res.json({ message: "Retake override removed." }); }
  catch (error) { console.error("[removeRetakeOverride]", error); return res.status(500).json({ message: "Unable to remove the retake override." }); }
};
