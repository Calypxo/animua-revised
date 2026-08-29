import { API_BASE_URL } from "/src/utils/api.js";
import { optimizedPublicImageUrl } from "/src/utils/image.js";
import { ensureUserSession, getUserSession, hasUserSession } from "/src/utils/storage.js";
import {
  deleteQueuedPublicRequest,
  getQueuedPublicRequests,
  isNetworkError,
  markQueuedPublicRequestAttempt,
  queuePublicRequest,
} from "../../services/offlinePublicQueue.service.js";

const DEFAULT_DOG_IMAGE = new URL("../../assets/images/dog.jpg", import.meta.url).href;
const DEFAULT_CAT_IMAGE = new URL("../../assets/images/cat.jpg", import.meta.url).href;

/* ══════════════════════════════════════════════════════
   QUIZ DEFINITION
   Phase 0: Filters (3 questions — select tiles)
   Phases 1-4: Lifestyle / Social / Home / Affection (18 questions — 1-5 scale)
══════════════════════════════════════════════════════ */
const PHASES = [
  {
    id: 0, key: "filters", label: "Matching Preferences",
    icon: "bi-funnel-fill", iconBg: "#fdf0f0", iconColor: "var(--clay)",
    kicker: "Step 1 of 5", title: "Set your matching preferences",
    desc: "Piliin kung aling pets ang dapat isama sa matching.",
    questions: [
      {
        key: "preferredSpecies", label: "Preferred Species", isFilter: true,
        text: "Anong type of pet ang gusto mong makita sa matches?",
        hint: "Choose Dog, Cat, or No preference.",
        type: "tiles",
        options: [
          { label:"No preference", value:"Any", icon:"bi-grid-3x3-gap-fill" },
          { label:"Dog", value:"Dog", icon:"dog" },
          { label:"Cat", value:"Cat", icon:"cat" },
        ]
      },
      {
        key: "preferredSex", label: "Preferred Sex", isFilter: true,
        text: "May preferred sex ka ba for your pet?",
        hint: "Kapag Male or Female ang pinili, exact matches lang ang isasama.",
        type: "tiles",
        options: [
          { label:"No preference", value:"Any", icon:"bi-grid-3x3-gap-fill" },
          { label:"Male", value:"Male", icon:"bi-gender-male" },
          { label:"Female", value:"Female", icon:"bi-gender-female" },
        ]
      },
      {
        key: "acceptSpecialNeeds", label: "Significant Special-Care Needs", isFilter: true,
        text: "Open ka ba sa pets with significant special-care needs (rated 4-5/5)?",
        hint: "Pets rated 1-3 remain eligible; this filter applies only to ratings 4-5.",
        type: "toggle",
        options: [
          { label:"Hindi", value:"no", icon:"bi-x-circle" },
          { label:"Oo", value:"yes", icon:"bi-heart-pulse" },
        ]
      },
    ]
  },
  {
    id: 1, key: "lifestyle", label: "Lifestyle",
    icon: "bi-lightning-charge-fill", iconBg: "#e6f7f7", iconColor: "var(--teal)",
    kicker: "Step 2 of 5", title: "Lifestyle & activity",
    desc: "Pamumuhay at aktibidad.",
    questions: [
      { key:"energyLevel",       label:"Energy Level",       text:"How energetic do you want your pet to be?",             hint:"Gaano ka-energetic ang pet na gusto mo?", scale:["Very calm","Low energy","Moderate","Active","Very energetic"] },
      { key:"exerciseNeeds",     label:"Exercise Capacity",  text:"How much daily exercise can you realistically provide?",hint:"Gaano karaming daily exercise ang kaya mong ibigay?", scale:["Very little","A little","Moderate","A lot","Very high"] },
      { key:"independenceLevel", label:"Independence",       text:"How independent should your pet be?",                   hint:"Gaano ka-independent dapat ang pet mo?", scale:["Needs constant companionship","Low independence","Balanced","Quite independent","Very independent"] },
      { key:"attentionNeeds",    label:"Attention Capacity", text:"How much daily attention can you give your pet?",        hint:"Gaano karaming daily attention ang kaya mong ibigay sa pet?", scale:["Very little","A little","Moderate","A lot","Very high"] },
      { key:"playfulness",       label:"Playfulness",        text:"How playful do you want your pet to be?",               hint:"Gaano ka-playful ang pet na gusto mo?", scale:["Very calm","Slightly playful","Balanced","Playful","Very playful"] },
      { key:"adaptability",      label:"Routine Stability",  text:"How often does your daily routine change?",             hint:"Gaano kadalas nagbabago ang daily routine mo?", scale:["Very stable","Slightly changing","Moderate changes","Often changing","Very unpredictable"] },
    ]
  },
  {
    id: 2, key: "social", label: "Social Environment",
    icon: "bi-people-fill", iconBg: "#fff8e6", iconColor: "var(--amber)",
    kicker: "Step 3 of 5", title: "Social environment",
    desc: "Social na kapaligiran.",
    questions: [
      { key:"friendlinessToHumans", label:"Household Sociability",  text:"How social is your household overall?",                         hint:"Gaano kasocial ang inyong household?", scale:["Very quiet","Slightly social","Moderately social","Social","Very social"] },
      { key:"goodWithKids",         label:"Kids at Home",           text:"How often will your pet interact with children?",                hint:"Gaano kadalas makakasalamuha ng pet ang mga bata?", scale:["Never","Rarely","Sometimes","Often","Daily - it's a must"] },
      { key:"goodWithOtherPets",    label:"Other Pets",             text:"Will your pet live with or interact with other pets?",           hint:"Makakasama ba ng pet ang ibang hayop?", scale:["No other pets","Rare contact","Sometimes","Often","Yes, definitely"] },
      { key:"strangerTolerance",    label:"Visitor Comfort",        text:"How comfortable should your pet be around visitors or strangers?",hint:"Gaano dapat kakomportable ang pet sa bisita o strangers?", scale:["Very cautious","Reserved","Balanced","Friendly","Very welcoming"] },
    ]
  },
  {
    id: 3, key: "care", label: "Home & Care",
    icon: "bi-house-heart-fill", iconBg: "#e8f7ee", iconColor: "var(--green)",
    kicker: "Step 4 of 5", title: "Home, care & maintenance",
    desc: "Bahay, alaga, at maintenance.",
    questions: [
      { key:"noiseLevel",        label:"Noise Tolerance",      text:"How much noise can you comfortably handle from a pet?",      hint:"Gaano karaming ingay mula sa pet ang kaya mong tanggapin?", scale:["Very little","Low","Moderate","High","Very high"] },
      { key:"spaceNeeds",        label:"Living Space",         text:"How much living space can you provide?",                     hint:"Gaano kalaking living space ang kaya mong ibigay?", scale:["Very small (studio)","Small","Average","Large","Very large with yard"] },
      { key:"climateTolerance",  label:"Climate Readiness",    text:"Can you care for a pet in Angeles City's warm climate?",     hint:"Kaya mo bang alagaan ang pet sa mainit na klima ng Angeles City?", scale:["Not ready","Slightly ready","Moderately ready","Ready","Fully prepared"] },
      { key:"groomingNeeds",     label:"Grooming Commitment",  text:"How willing are you to groom your pet regularly?",           hint:"Gaano ka kahandang mag-groom ng pet nang regular?", scale:["Not willing","Slightly willing","Moderate effort","Willing","Very willing"] },
      { key:"trainingDifficulty",label:"Training Commitment",  text:"How much training difficulty can you handle?",               hint:"Gaano kahirap na training ang kaya mong hawakan?", scale:["Very easy only","Low difficulty","Moderate","Can handle difficult","Very experienced trainer"] },
      { key:"healthRiskLevel",   label:"Vet Budget",           text:"How prepared are you for veterinary costs?",                 hint:"Gaano ka kahanda sa gastusing veterinary?", scale:["Not prepared","Slightly prepared","Somewhat prepared","Prepared","Fully prepared"] },
    ]
  },
  {
    id: 4, key: "affection", label: "Affection",
    icon: "bi-heart-fill", iconBg: "#fdf0f0", iconColor: "var(--clay)",
    kicker: "Step 5 of 5", title: "Affection & attachment",
    desc: "Lambing at attachment.",
    questions: [
      { key:"affectionLevel",    label:"Affection Preference",  text:"How affectionate do you want your pet to be?", hint:"Gaano kalambing ang pet na gusto mo?", scale:["Very independent","Not very affectionate","Balanced","Affectionate","Very cuddly"] },
      { key:"separationAnxiety", label:"Clinginess Tolerance",  text:"How comfortable are you with a clingy pet?",    hint:"Gaano ka kakomportable sa clingy na pet?", scale:["Not comfortable","Slightly OK","Neutral","Comfortable","Completely fine with it"] },
    ]
  }
];

const PHASE_TIPS = [
  "Inaalis ng choices dito ang pets na hindi pasok bago i-calculate ang compatibility score.",
  "Maging tapat sa tunay mong routine, hindi sa ideal version nito.",
  "Isaalang-alang ang buong household - bata, kasama sa bahay, at ibang pets.",
  "Isipin ang kasalukuyang bahay at setup mo, hindi future plan lang.",
  "Mahalaga rin ang bond na gusto mo, hindi lang practical needs.",
];

const escapeQuizText = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

async function loadQuestionConfiguration() {
  const response = await fetch(`${API_BASE_URL}/match/questions`, {
    credentials: "include",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Unable to load quiz questions.");
  if (!Array.isArray(data.questions) || !data.questions.length) throw new Error("The quiz question configuration is incomplete.");

  const configuredByPhase = new Map();
  data.questions
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .forEach((question) => {
      const list = configuredByPhase.get(question.phaseKey) || [];
      list.push({
        id: question.id,
        key: question.traitKey,
        label: question.label,
        text: question.text,
        hint: question.hint || "Select the answer that best reflects your situation.",
        choices: (question.choices || []).slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0)),
      });
      configuredByPhase.set(question.phaseKey, list);
    });

  PHASES.filter((phase) => phase.id > 0).forEach((phase) => {
    const configured = configuredByPhase.get(phase.key);
    phase.questions = configured || [];
  });
  totalQ = PHASES.reduce((sum, phase) => sum + phase.questions.length, 0);
}
const QUIZ_LANGUAGE_KEY = "animua_quiz_language";
const QUIZ_DRAFT_KEY = "animua_quiz_offline_draft";
const QUIZ_PENDING_RESULT_KEY = "animua_quiz_pending_sync_result";
let quizLanguage = localStorage.getItem(QUIZ_LANGUAGE_KEY) === "tagalog" ? "tagalog" : "english";

const PHASE_COPY = {
  english: {
    filters: {
      kicker: "Step 1 of 5",
      title: "Set your filters",
      desc: "Tell us what you're looking for so we can find the best matches."
    },
    lifestyle: {
      kicker: "Step 2 of 5",
      title: "Lifestyle & activity",
      desc: "Tell us about your daily routine and activity level."
    },
    social: {
      kicker: "Step 3 of 5",
      title: "Social environment",
      desc: "Share who your future pet will meet at home."
    },
    care: {
      kicker: "Step 4 of 5",
      title: "Home, care & maintenance",
      desc: "Help us understand your space, care capacity, and budget readiness."
    },
    affection: {
      kicker: "Step 5 of 5",
      title: "Affection & attachment",
      desc: "Tell us what kind of bond feels right for you."
    }
  },
  tagalog: {
    filters: {
      kicker: "Hakbang 1 ng 5",
      title: "Itakda ang iyong filters",
      desc: "Sabihin kung anong pet ang hinahanap mo para makahanap kami ng best matches."
    },
    lifestyle: {
      kicker: "Hakbang 2 ng 5",
      title: "Lifestyle at activity",
      desc: "Ibahagi ang iyong daily routine at activity level."
    },
    social: {
      kicker: "Hakbang 3 ng 5",
      title: "Social environment",
      desc: "Sabihin kung sino ang makakasalamuha ng future pet mo sa bahay."
    },
    care: {
      kicker: "Hakbang 4 ng 5",
      title: "Bahay, alaga, at maintenance",
      desc: "Tulungan kaming maintindihan ang space, care capacity, at budget readiness mo."
    },
    affection: {
      kicker: "Hakbang 5 ng 5",
      title: "Lambing at attachment",
      desc: "Sabihin kung anong klase ng bond ang bagay sa iyo."
    }
  }
};

const QUESTION_COPY = {
  english: {
    preferredSpecies: {
      text: "What species are you interested in?",
      hint: "Choose Any, Dog, or Cat.",
      options: { Any: "Any", Dog: "Dog", Cat: "Cat" }
    },
    preferredSex: {
      text: "Do you have a preferred sex for your pet?",
      hint: "Choose Any if male or female pets are both okay.",
      options: { Any: "Any", Male: "Male", Female: "Female" }
    },
    acceptSpecialNeeds: {
      text: "Are you open to pets with significant special-care needs?",
      hint: "This only affects pets with higher care needs.",
      options: { no: "No", yes: "Yes" }
    },
    energyLevel: { hint: "Choose the energy level that fits your home." },
    exerciseNeeds: { hint: "Choose the amount of daily exercise you can realistically provide." },
    independenceLevel: { hint: "Choose how independent your pet should be." },
    attentionNeeds: { hint: "Choose how much daily attention you can give." },
    playfulness: { hint: "Choose how playful you want your pet to be." },
    adaptability: { hint: "Choose how stable or changing your routine is." },
    friendlinessToHumans: { hint: "Choose how social your household is." },
    goodWithKids: { hint: "Choose how often the pet will interact with children." },
    goodWithOtherPets: { hint: "Choose whether the pet will live with or meet other pets." },
    strangerTolerance: { hint: "Choose how comfortable your pet should be with visitors." },
    noiseLevel: { hint: "Choose how much pet noise you can comfortably handle." },
    spaceNeeds: { hint: "Choose the living space you can provide." },
    climateTolerance: { hint: "Choose how ready you are to care for a pet in Angeles City's warm climate." },
    groomingNeeds: { hint: "Choose how willing you are to groom regularly." },
    trainingDifficulty: { hint: "Choose how much training difficulty you can handle." },
    healthRiskLevel: { hint: "Choose how prepared you are for veterinary costs." },
    affectionLevel: { hint: "Choose how affectionate you want your pet to be." },
    separationAnxiety: { hint: "Choose how comfortable you are with a clingy pet." }
  },
  tagalog: {
    preferredSpecies: {
      text: "Anong uri ng pet ang interesado ka?",
      hint: "Pumili ng kahit ano, aso, o pusa.",
      options: { Any: "Kahit ano", Dog: "Aso", Cat: "Pusa" }
    },
    preferredSex: {
      text: "May gusto ka bang kasarian para sa pet mo?",
      hint: "Piliin ang kahit ano kung okay lang sa iyo ang lalaki o babae.",
      options: { Any: "Kahit ano", Male: "Lalaki", Female: "Babae" }
    },
    acceptSpecialNeeds: {
      text: "Handa ka ba sa pets na may mas mataas na special-care needs?",
      hint: "Para lang ito sa pets na nangangailangan ng mas mataas na alaga.",
      options: { no: "Hindi", yes: "Oo" }
    },
    energyLevel: {
      text: "Gaano ka-energetic ang pet na gusto mo?",
      hint: "Piliin ang energy level na bagay sa bahay mo.",
      scale: ["Sobrang kalmado", "Mababa ang energy", "Katamtaman", "Aktibo", "Sobrang energetic"]
    },
    exerciseNeeds: {
      text: "Gaano karaming daily exercise ang kaya mong ibigay?",
      hint: "Piliin ang dami ng exercise na realistic mong maibibigay araw-araw.",
      scale: ["Kaunti lang", "Medyo kaunti", "Katamtaman", "Marami", "Napakarami"]
    },
    independenceLevel: {
      text: "Gaano ka-independent dapat ang pet mo?",
      hint: "Piliin kung gaano ka-independent ang bagay sa routine mo.",
      scale: ["Laging kailangan ng kasama", "Hindi masyadong independent", "Balanced", "Medyo independent", "Sobrang independent"]
    },
    attentionNeeds: {
      text: "Gaano karaming attention ang kaya mong ibigay araw-araw?",
      hint: "Piliin kung gaano karaming oras at attention ang kaya mong ibigay.",
      scale: ["Kaunti lang", "Medyo kaunti", "Katamtaman", "Marami", "Napakarami"]
    },
    playfulness: {
      text: "Gaano ka-playful ang pet na gusto mo?",
      hint: "Piliin kung gaano kalikot o kalaro ang gusto mong pet.",
      scale: ["Sobrang kalmado", "Medyo playful", "Balanced", "Playful", "Sobrang playful"]
    },
    adaptability: {
      text: "Gaano kadalas nagbabago ang daily routine mo?",
      hint: "Piliin kung gaano ka-stable o pabago-bago ang routine mo.",
      scale: ["Sobrang stable", "Bahagyang nagbabago", "Katamtamang pagbabago", "Madalas magbago", "Sobrang pabago-bago"]
    },
    friendlinessToHumans: {
      text: "Gaano kasocial ang household ninyo?",
      hint: "Piliin kung gaano kadalas may tao at interaction sa bahay.",
      scale: ["Sobrang tahimik", "Medyo social", "Katamtaman", "Social", "Sobrang social"]
    },
    goodWithKids: {
      text: "Gaano kadalas makakasalamuha ng pet ang mga bata?",
      hint: "Piliin kung gaano kadalas magkakaroon ng interaction sa children.",
      scale: ["Hindi kailanman", "Bihira", "Minsan", "Madalas", "Araw-araw"]
    },
    goodWithOtherPets: {
      text: "Makakasama ba ng pet ang ibang pets?",
      hint: "Piliin kung may ibang hayop sa bahay o madalas makakasalamuha.",
      scale: ["Walang ibang pets", "Bihirang contact", "Minsan", "Madalas", "Oo, siguradong may kasama"]
    },
    strangerTolerance: {
      text: "Gaano dapat kakomportable ang pet sa bisita o strangers?",
      hint: "Piliin kung gaano kadalas at ka-comfortable dapat sa visitors.",
      scale: ["Sobrang maingat", "Reserved", "Balanced", "Friendly", "Sobrang welcoming"]
    },
    noiseLevel: {
      text: "Gaano karaming ingay mula sa pet ang kaya mong tanggapin?",
      hint: "Piliin ang noise level na komportable sa bahay mo.",
      scale: ["Kaunti lang", "Mababa", "Katamtaman", "Mataas", "Sobrang taas"]
    },
    spaceNeeds: {
      text: "Gaano kalaking living space ang kaya mong ibigay?",
      hint: "Piliin ang space na available sa bahay mo.",
      scale: ["Maliit na studio", "Maliit", "Katamtaman", "Malaki", "Malaki na may bakuran"]
    },
    climateTolerance: {
      text: "Kaya mo bang mag-alaga ng pet sa mainit na klima ng Angeles City?",
      hint: "Piliin kung gaano ka kahanda sa init at climate care.",
      scale: ["Hindi pa handa", "Medyo handa", "Katamtamang handa", "Handa", "Sobrang handa"]
    },
    groomingNeeds: {
      text: "Gaano ka kahandang mag-groom ng pet nang regular?",
      hint: "Piliin ang grooming effort na kaya mong panindigan.",
      scale: ["Hindi handa", "Medyo handa", "Katamtaman", "Handa", "Sobrang handa"]
    },
    trainingDifficulty: {
      text: "Gaano kahirap na training ang kaya mong hawakan?",
      hint: "Piliin ang training difficulty na kaya mong suportahan.",
      scale: ["Madali lang", "Mababang difficulty", "Katamtaman", "Kaya ang mahirap", "May malawak na experience"]
    },
    healthRiskLevel: {
      text: "Gaano ka kahanda sa veterinary costs?",
      hint: "Piliin kung gaano ka kahanda sa posibleng gastos sa vet.",
      scale: ["Hindi handa", "Medyo handa", "May konting handa", "Handa", "Sobrang handa"]
    },
    affectionLevel: {
      text: "Gaano kalambing ang pet na gusto mo?",
      hint: "Piliin kung gaano ka-affectionate ang bagay sa iyo.",
      scale: ["Sobrang independent", "Hindi masyadong malambing", "Balanced", "Malambing", "Sobrang lambing"]
    },
    separationAnxiety: {
      text: "Gaano ka kakomportable sa clingy na pet?",
      hint: "Piliin kung gaano ka okay sa pet na laging gusto ng kasama.",
      scale: ["Hindi komportable", "Medyo okay", "Neutral", "Komportable", "Sobrang okay"]
    }
  }
};

const UI_COPY = {
  english: {
    question: "Question",
    of: "of",
    previous: "Previous",
    next: "Next",
    submit: "Find My Matches",
    submitting: "Finding Matches...",
    sidebarNoteTime: "Takes 3-5 minutes",
    sidebarNoteReview: "Shelter-reviewed recommendations",
    headerIntro: "Answer a few simple questions to get matched with animals who may be the perfect fit for you.",
    validation: "Please answer all questions in this section before continuing.",
    retakeTitle: "Retake available",
    retakeText: "Your previous result remains in your account history. Answer the quiz again below to update your matches.",
    steps: [
      ["Basic Filters", "Set your preferences"],
      ["Lifestyle", "Your daily routine"],
      ["Social", "People and other pets"],
      ["Home & Care", "Living environment"],
      ["Affection", "Bonding preferences"],
    ]
  },
  tagalog: {
    question: "Tanong",
    of: "ng",
    previous: "Bumalik",
    next: "Susunod",
    submit: "Hanapin ang Matches",
    submitting: "Hinahanap ang Matches...",
    sidebarNoteTime: "Tumatagal ng 3-5 minuto",
    sidebarNoteReview: "Shelter-reviewed recommendations",
    headerIntro: "Sagutan ang ilang simpleng tanong para ma-match ka sa hayop na maaaring bagay sa iyo.",
    validation: "Sagutan muna ang lahat ng tanong sa section na ito bago magpatuloy.",
    retakeTitle: "Pwede nang ulitin",
    retakeText: "Nasa account history mo pa rin ang dating resulta. Sagutan muli ang quiz sa ibaba para ma-update ang matches mo.",
    steps: [
      ["Basic Filters", "Itakda ang preferences"],
      ["Lifestyle", "Daily routine mo"],
      ["Social", "Tao at ibang pets"],
      ["Home & Care", "Kapaligiran sa bahay"],
      ["Affection", "Bonding preferences"],
    ]
  }
};

/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let answers     = {};
let selectedChoices = {};
let currentPhase= 0;
let totalQ    = PHASES.reduce((s,p) => s+p.questions.length, 0);
let isSubmitting = false;
let isSyncingQueuedQuiz = false;

function saveQuizDraft() {
  try {
    localStorage.setItem(
      QUIZ_DRAFT_KEY,
      JSON.stringify({
        answers,
        selectedChoices,
        currentPhase,
        savedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn("Unable to save quiz draft:", error.message);
  }
}

function restoreQuizDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(QUIZ_DRAFT_KEY) || "null");
    if (!draft?.answers || typeof draft.answers !== "object") return;
    answers = draft.answers;
    selectedChoices = draft.selectedChoices && typeof draft.selectedChoices === "object"
      ? draft.selectedChoices
      : {};
    currentPhase = Math.min(PHASES.length - 1, Math.max(0, Number(draft.currentPhase || 0)));
  } catch (error) {
    localStorage.removeItem(QUIZ_DRAFT_KEY);
  }
}

function clearQuizDraft() {
  localStorage.removeItem(QUIZ_DRAFT_KEY);
}

async function postQuizMatch(quizData) {
  const response = await fetch(`${API_BASE_URL}/match`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(quizData)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.message || "Failed to fetch compatibility matches.");
    error.status = response.status;
    throw error;
  }

  return result;
}

function storeQuizResult(quizData, result) {
  const matched = result.matches || [];
  sessionStorage.setItem("animua_quiz_data", JSON.stringify(quizData));
  sessionStorage.setItem("animua_match_results", JSON.stringify(matched));
  sessionStorage.setItem("animua_match_metadata", JSON.stringify({
    resultId: result.resultId,
    completedAt: result.completedAt,
    nextRetakeAt: result.nextRetakeAt,
  }));
  sessionStorage.setItem("animua_match_fresh", "1");
  clearQuizDraft();
}

async function syncQueuedQuizSubmissions() {
  if (isSyncingQueuedQuiz || !navigator.onLine) return;
  isSyncingQueuedQuiz = true;

  try {
    const queued = await getQueuedPublicRequests("compatibilityQuiz");
    for (const item of queued) {
      try {
        const result = await postQuizMatch(item.payload.quizData);
        await deleteQueuedPublicRequest(item.id);
        localStorage.setItem(QUIZ_PENDING_RESULT_KEY, JSON.stringify({
          quizData: item.payload.quizData,
          result,
          syncedAt: new Date().toISOString(),
        }));
      } catch (error) {
        await markQueuedPublicRequestAttempt(item.id, error);
        if (isNetworkError(error)) break;
      }
    }
  } catch (error) {
    console.error("Failed to sync queued quiz submissions:", error);
  } finally {
    isSyncingQueuedQuiz = false;
  }
}

function isPhaseComplete(phaseIdx = currentPhase) {
  return PHASES[phaseIdx].questions.every((q) => answers[q.key] !== undefined);
}

function getUnansweredQuestions(phaseIdx = currentPhase) {
  return PHASES[phaseIdx].questions.filter((q) => answers[q.key] === undefined);
}

function getPhaseCopy(phase) {
  return PHASE_COPY[quizLanguage]?.[phase.key] || phase;
}

function getQuestionCopy(question) {
  return QUESTION_COPY[quizLanguage]?.[question.key] || {};
}

function getOptionLabel(question, option) {
  return getQuestionCopy(question).options?.[option.value] || option.label;
}

function getScaleChoices(question) {
  const translatedLabels = getQuestionCopy(question).scale || [];
  if (Array.isArray(question.choices) && question.choices.length) {
    return question.choices.map((choice, index) => ({
      ...choice,
      text: translatedLabels[index] || choice.text,
    }));
  }
  return (translatedLabels.length ? translatedLabels : question.scale || []).map((text, index) => ({
    id: "",
    text,
    value: index + 1,
  }));
}

function getUiCopy(key) {
  return UI_COPY[quizLanguage]?.[key] || UI_COPY.english[key] || key;
}

function getStepCopy(index) {
  return UI_COPY[quizLanguage]?.steps?.[index] || UI_COPY.english.steps[index];
}

function updateRetakeNote() {
  const access = document.getElementById("quizAccessCard");
  if (!access?.classList.contains("quiz-retake-note")) return;
  access.innerHTML = `<strong>${getUiCopy("retakeTitle")}</strong><span>${getUiCopy("retakeText")}</span>`;
}

function updateSidebarNote() {
  const note = document.querySelector(".quiz-sidebar-note");
  if (!note) return;
  note.innerHTML = `
    <i class="bi bi-shield-check" aria-hidden="true"></i>
    <span>${getUiCopy("sidebarNoteTime")}</span>
    <b aria-hidden="true">•</b>
    <span>${getUiCopy("sidebarNoteReview")}</span>`;
}

function updateLanguageToggle() {
  document.body.classList.toggle("quiz-lang-tagalog", quizLanguage === "tagalog");
  document.body.classList.toggle("quiz-lang-english", quizLanguage === "english");
  const headerIntro = document.getElementById("quizHeaderIntro");
  if (headerIntro) {
    headerIntro.textContent = getUiCopy("headerIntro");
  }
  updateRetakeNote();
  updateSidebarNote();
  document.querySelectorAll("[data-quiz-language]").forEach((button) => {
    const isActive = button.dataset.quizLanguage === quizLanguage;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getTileIcon(opt) {
  const key = String(opt.value || opt.label || "").toLowerCase();
  const animalIcons = {
    dog: `
      <svg class="select-tile-animal" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M8 15.2c0-5 3.4-8.4 8-8.4s8 3.4 8 8.4v6.3"/>
        <path d="M8 15.2v5.9"/>
        <path d="M10.9 18.9v3.2c0 2.2 1.8 4 4 4h2.2c2.2 0 4-1.8 4-4v-3.2"/>
        <circle cx="12.5" cy="15.5" r="1.2"/>
        <circle cx="19.5" cy="15.5" r="1.2"/>
        <path d="M14.5 19.4h3"/>
        <path d="M16 19.4v2.1"/>
        <path d="M12.2 22.1c1.4 2.2 3.1 2.2 3.8 0"/>
        <path d="M19.8 22.1c-1.4 2.2-3.1 2.2-3.8 0"/>
      </svg>`,
    cat: `
      <svg class="select-tile-animal" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M6.6 10.2 11 13.4c1.5-.6 3.2-.9 5-.9s3.5.3 5 .9l4.4-3.2v9.5c0 4.6-3.7 7.7-9.4 7.7s-9.4-3.1-9.4-7.7v-9.5Z"/>
        <circle cx="12.4" cy="18.2" r="1.3"/>
        <circle cx="19.6" cy="18.2" r="1.3"/>
        <path d="M14.9 22h2.2"/>
      </svg>`,
  };
  if (animalIcons[key]) {
    return animalIcons[key];
  }
  if (opt.icon?.startsWith("bi-")) {
    return `<i class="bi ${opt.icon}" aria-hidden="true"></i>`;
  }
  const icons = {
    any: "bi-grid-3x3-gap-fill",
    male: "bi-gender-male",
    female: "bi-gender-female",
  };
  const icon = icons[key] || "bi-check2-circle";
  return `<i class="bi ${icon}" aria-hidden="true"></i>`;
}

/* ══════════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════════ */
function renderPhase(phaseIdx) {
  const phase = PHASES[phaseIdx];
  const phaseCopy = getPhaseCopy(phase);
  const area  = document.getElementById("questionArea");

  // Update sidebar tip
  document.getElementById("tipText").textContent  = PHASE_TIPS[phaseIdx];
  document.getElementById("phaseBadge").textContent= phase.label;

  // Update phase steps in sidebar
  document.querySelectorAll(".phase-step").forEach((el, i) => {
    el.classList.remove("active","done");
    if (i < phaseIdx)  el.classList.add("done");
    if (i === phaseIdx) el.classList.add("active");
    const stepText = el.querySelector("span");
    const stepCopy = getStepCopy(i);
    if (stepText && stepCopy) {
      stepText.textContent = stepCopy[0];
      stepText.dataset.stepDescription = stepCopy[1];
    }
    // update dot icon
    const dot = el.querySelector(".phase-step-dot");
    if (dot) {
      dot.innerHTML = i < phaseIdx
        ? `<i class="bi bi-check2"></i>`
        : `<i class="bi ${PHASES[i].icon}"></i>`;
    }
  });

  let html = `
    <div class="phase-intro slide-in">
      <div class="phase-intro-icon" style="background:${phase.iconBg};color:${phase.iconColor}">
        <i class="bi ${phase.icon}"></i>
      </div>
      <div>
        <div class="phase-intro-kicker">${phaseCopy.kicker || phase.kicker}</div>
        <div class="phase-intro-title">${phaseCopy.title}</div>
        <div class="phase-intro-desc">${phaseCopy.desc}</div>
      </div>
    </div>`;

  phase.questions.forEach((q, qi) => {
    const questionCopy = getQuestionCopy(q);
    const globalIdx = PHASES.slice(0, phaseIdx).reduce((s,p) => s+p.questions.length,0) + qi + 1;
    const answered  = answers[q.key] !== undefined;

    if (q.type === "tiles") {
      html += `
        <div class="filter-section slide-in ${answered?"answered":""}" data-key="${q.key}" style="animation-delay:${qi*40}ms">
          <div class="q-num">${getUiCopy("question")} ${globalIdx}</div>
          <div class="q-text">${escapeQuizText(questionCopy.text || q.text)}</div>
          <div class="q-hint">${escapeQuizText(questionCopy.hint || q.hint)}</div>
          <div class="select-tiles">
            ${q.options.map(opt => `
              <div class="select-tile ${answers[q.key]===opt.value?"selected":""}"
                   data-key="${q.key}" data-value="${opt.value}">
                <div class="select-tile-icon">${getTileIcon(opt)}</div>
                <div class="select-tile-label">${escapeQuizText(getOptionLabel(q, opt))}</div>
              </div>`).join("")}
          </div>
        </div>`;
    } else if (q.type === "toggle") {
      html += `
        <div class="filter-section slide-in ${answered?"answered":""}" data-key="${q.key}" style="animation-delay:${qi*40}ms">
          <div class="q-num">${getUiCopy("question")} ${globalIdx}</div>
          <div class="q-text">${escapeQuizText(questionCopy.text || q.text)}</div>
          <div class="q-hint">${escapeQuizText(questionCopy.hint || q.hint)}</div>
          <div class="toggle-group">
            ${q.options.map(opt => `
              <div class="toggle-tile ${answers[q.key]===opt.value?(opt.value==="yes"?"selected-yes":"selected-no"):""}"
                   data-key="${q.key}" data-value="${opt.value}">
                <span class="toggle-icon">${getTileIcon(opt)}</span>${getOptionLabel(q, opt)}
              </div>`).join("")}
          </div>
        </div>`;
    } else {
      // 1-5 scale
      html += `
        <div class="question-card slide-in ${answered?"answered":""}" data-key="${q.key}" style="animation-delay:${qi*40}ms">
          <div class="q-num">${getUiCopy("question")} ${globalIdx}</div>
          <div class="q-text">${escapeQuizText(questionCopy.text || q.text)}</div>
          <div class="q-hint">${escapeQuizText(questionCopy.hint || q.hint)}</div>
          <div class="option-group">
            ${getScaleChoices(q).map((choice) => `
              <button class="option-btn ${(selectedChoices[q.key] ? selectedChoices[q.key] === choice.id : answers[q.key] === Number(choice.value)) ? "selected" : ""}"
                      data-key="${q.key}" data-value="${Number(choice.value)}" data-choice-id="${escapeQuizText(choice.id || "")}" type="button">
                <span class="option-num">${Number(choice.value)}</span>
                <span class="option-label">${escapeQuizText(choice.text)}</span>
              </button>`).join("")}
          </div>
        </div>`;
    }
  });

  // Navigation
  const isLast = phaseIdx === PHASES.length - 1;
  html += `
    <div class="quiz-validation-message" id="quizValidationMessage" role="alert" hidden>
      <i class="bi bi-exclamation-circle"></i>
      <span>${getUiCopy("validation")}</span>
    </div>
    <div class="quiz-nav slide-in" style="animation-delay:${phase.questions.length*40+40}ms">
      <button class="btn-prev" id="btnPrev" ${phaseIdx===0?"disabled":""}>
        <i class="bi bi-arrow-left"></i> ${getUiCopy("previous")}
      </button>
      ${isLast
        ? `<button class="btn-submit" id="btnSubmit" type="button">
             <i class="bi bi-stars"></i> ${getUiCopy("submit")}
           </button>`
        : `<button class="btn-next" id="btnNext" type="button">
             ${getUiCopy("next")} <i class="bi bi-arrow-right"></i>
           </button>`
      }
    </div>`;

  area.innerHTML = html;
  updateLanguageToggle();
  updateNavState();

  // Bind events
  area.querySelectorAll(".option-btn, .select-tile, .toggle-tile").forEach(el => {
    el.addEventListener("click", () => handleAnswer(el.dataset.key, el.dataset.value, el.dataset.choiceId));
  });

  document.getElementById("btnPrev")?.addEventListener("click", () => {
    if (currentPhase > 0) { currentPhase--; renderPhase(currentPhase); updateProgress(); }
  });

  document.getElementById("btnNext")?.addEventListener("click", () => {
    if (!validateCurrentPhase()) return;
    if (currentPhase < PHASES.length - 1) {
      currentPhase++;
      renderPhase(currentPhase);
      updateProgress();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  document.getElementById("btnSubmit")?.addEventListener("click", () => {
    if (!validateCurrentPhase()) return;
    handleSubmit();
  });

}

function handleAnswer(key, value, choiceId = "", silent = false) {
  const wasAnswered = answers[key] !== undefined;
  answers[key] = isNaN(value) ? value : Number(value);
  if (choiceId) selectedChoices[key] = choiceId;

  if (!silent) {
    // Update the clicked element visually
    const card = document.querySelector(`[data-key="${key}"]`)?.closest(".question-card, .filter-section");
    if (card) card.classList.add("answered");
    if (card) card.classList.remove("needs-answer");

    // Deselect siblings
    document.querySelectorAll(`[data-key="${key}"]`).forEach(el => {
      el.classList.remove("selected","selected-yes","selected-no");
    });

    // Select clicked
    const clicked = choiceId
      ? document.querySelector(`[data-key="${key}"][data-choice-id="${choiceId}"]`)
      : document.querySelector(`[data-key="${key}"][data-value="${value}"]`);
    if (clicked) {
      if (clicked.classList.contains("toggle-tile")) {
        clicked.classList.add(value==="yes"?"selected-yes":"selected-no");
      } else {
        clicked.classList.add("selected");
      }
    }
  }

  updateProgress();
  updateAnswerChips();
  updateNavState();
  saveQuizDraft();
  if (isPhaseComplete()) hideValidationMessage();
}

function updateProgress() {
  const pct = Math.round((Object.keys(answers).length / totalQ) * 100);
  document.getElementById("progressFill").style.width  = pct + "%";

  // Count answered in all phases
  let done = 0, total = 0;
  PHASES.forEach(p => { p.questions.forEach(() => total++); });
  Object.keys(answers).forEach(() => done++);
  const currentQuestion = total ? Math.min(done, total) : 0;
  document.getElementById("progressLabel").textContent = `${getUiCopy("question")} ${currentQuestion}\u00a0${getUiCopy("of")}\u00a0${total}`;
  const progressPercentLabel = document.getElementById("progressPercentLabel");
  if (progressPercentLabel) {
    progressPercentLabel.textContent = `${pct}% complete`;
  }
}

function updateNavState() {
  const isComplete = isPhaseComplete();
  const nextButton = document.getElementById("btnNext");
  const submitButton = document.getElementById("btnSubmit");
  if (nextButton) {
    nextButton.classList.toggle("needs-completion", !isComplete);
    nextButton.setAttribute("aria-disabled", String(!isComplete));
  }
  if (submitButton) {
    submitButton.classList.toggle("needs-completion", !isComplete);
    submitButton.setAttribute("aria-disabled", String(!isComplete));
  }
}

function hideValidationMessage() {
  const message = document.getElementById("quizValidationMessage");
  if (!message) return;
  message.hidden = true;
}

function validateCurrentPhase() {
  const unanswered = getUnansweredQuestions();
  const message = document.getElementById("quizValidationMessage");

  document.querySelectorAll(".question-card, .filter-section").forEach((card) => {
    card.classList.remove("needs-answer");
  });

  if (!unanswered.length) {
    hideValidationMessage();
    return true;
  }

  unanswered.forEach((q) => {
    document.querySelector(`[data-key="${q.key}"]`)?.classList.add("needs-answer");
  });

  if (message) {
    const label = unanswered.length === 1 ? "question" : "questions";
    message.querySelector("span").textContent =
      `Please answer ${unanswered.length} remaining ${label} in this section before continuing.`;
    message.hidden = false;
  }

  document.querySelector(`[data-key="${unanswered[0].key}"]`)?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  return false;
}

function updateAnswerChips() {
  const container = document.getElementById("answerChips");
  const entries   = Object.entries(answers);
  if (!entries.length) {
    container.innerHTML = `<div style="font-size:0.78rem;color:var(--stone-2);text-align:center;padding:8px">No answers yet</div>`;
    return;
  }
  container.innerHTML = entries.slice(-8).reverse().map(([k,v]) => {
    // Find label
    let label = k;
    PHASES.forEach(p => p.questions.forEach(q => { if (q.key===k) label = q.label; }));
    return `<div class="answer-chip"><span class="answer-chip-key">${escapeQuizText(label)}</span><span class="answer-chip-val">${v}</span></div>`;
  }).join("");
}

async function handleSubmit() {
  if (isSubmitting) return;
  isSubmitting = true;

  const submitButton = document.getElementById("btnSubmit");
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.innerHTML = `<i class="bi bi-arrow-repeat"></i> ${getUiCopy("submitting")}`;
  }

  const preferences = PHASES
    .flatMap((phase) => phase.questions)
    .filter((question) => !question.isFilter)
    .reduce((payload, question) => {
      payload[question.key] = answers[question.key];
      return payload;
    }, {});

  const quizData = {
    filters: {
      preferredSpecies:    answers.preferredSpecies    || "Any",
      preferredSex:        answers.preferredSex        || "Any",
      needAllergyFriendly: answers.needAllergyFriendly || "no",
      acceptSpecialNeeds:  answers.acceptSpecialNeeds  || "yes",
    },
    preferences,
    answerSelections: selectedChoices,
  };

  try {
    const result = await postQuizMatch(quizData);
    storeQuizResult(quizData, result);

    window.location.href = "/pages/public/compatibilityResults.html?source=quiz";
  } catch (err) {
    console.error("Matching failed:", err);
    if (isNetworkError(err)) {
      try {
        await queuePublicRequest("compatibilityQuiz", { quizData });
        sessionStorage.setItem("animua_quiz_data", JSON.stringify(quizData));
        document.getElementById("quizMain").style.display = "none";
        document.getElementById("completionScreen").style.display = "flex";
        document.querySelector(".quiz-phase-nav")?.setAttribute("hidden", "");
        document.getElementById("completionScreen").innerHTML = `
          <div class="complete-card">
            <span class="complete-icon"><i class="bi bi-cloud-arrow-up"></i></span>
            <h2 class="complete-title">Quiz saved offline.</h2>
            <p class="complete-sub">Your answers are saved on this device. ANIMUA will submit them when internet returns, then your matches can be opened from this device.</p>
            <button class="btn-submit" id="retryMatchBtn" type="button">
              <i class="bi bi-arrow-clockwise"></i>
              Try Sync Now
            </button>
          </div>`;
        document.getElementById("retryMatchBtn")?.addEventListener("click", async () => {
          await syncQueuedQuizSubmissions();
          const pendingResult = JSON.parse(localStorage.getItem(QUIZ_PENDING_RESULT_KEY) || "null");
          if (pendingResult?.quizData && pendingResult?.result) {
            storeQuizResult(pendingResult.quizData, pendingResult.result);
            localStorage.removeItem(QUIZ_PENDING_RESULT_KEY);
            window.location.href = "/pages/public/compatibilityResults.html?source=quiz";
          }
        });
        return;
      } catch (storageError) {
        console.error("Failed to save quiz offline:", storageError);
      }
    }
    sessionStorage.setItem("animua_quiz_data", JSON.stringify(quizData));
    sessionStorage.setItem("animua_match_results", JSON.stringify([]));
    document.getElementById("quizMain").style.display = "none";
    document.getElementById("completionScreen").style.display = "flex";
    document.querySelector(".quiz-phase-nav")?.setAttribute("hidden", "");
    document.getElementById("completionScreen").innerHTML = `
      <div class="complete-card">
        <span class="complete-icon"><i class="bi bi-exclamation-circle"></i></span>
        <h2 class="complete-title">We could not load matches.</h2>
        <p class="complete-sub">${String(err.message || "Please try again.").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>
        <button class="btn-submit" id="retryMatchBtn" type="button">
          <i class="bi bi-arrow-clockwise"></i>
          Try Again
        </button>
      </div>`;
    document.getElementById("retryMatchBtn")?.addEventListener("click", () => {
      isSubmitting = false;
      document.getElementById("completionScreen").style.display = "none";
      document.getElementById("quizMain").style.display = "";
      document.querySelector(".quiz-phase-nav")?.removeAttribute("hidden");
      renderPhase(currentPhase);
      updateProgress();
    });
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.innerHTML = `<i class="bi bi-stars"></i> ${getUiCopy("submit")}`;
    }
    isSubmitting = false;
  }
}



function getAnimalPhotoUrl(animal) {
  if (!animal || typeof animal !== "object") return "";
  const candidates = [
    animal.photoURL,
    animal.imageUrl,
    animal.imageURL,
    animal.image,
    animal.photo,
    animal.thumbnailUrl,
    animal.primaryPhotoUrl,
    animal.animalPhotoUrl,
    animal.pet?.photoURL,
    animal.pet?.imageUrl,
    animal.animal?.photoURL,
    animal.animal?.imageUrl,
    ...(Array.isArray(animal.photos) ? animal.photos : []),
    ...(Array.isArray(animal.pet?.photos) ? animal.pet.photos : []),
    ...(Array.isArray(animal.animal?.photos) ? animal.animal.photos : []),
  ];
  return candidates.find((value) => typeof value === "string" && value.trim()) || "";
}

function getAnimalFallbackPhoto(animal) {
  const species = String(animal?.species || animal?.type || animal?.animalSpecies || "").toLowerCase();
  return species.includes("cat") ? DEFAULT_CAT_IMAGE : DEFAULT_DOG_IMAGE;
}

async function resolveTopMatchPhoto(match) {
  const directPhoto = getAnimalPhotoUrl(match);
  if (directPhoto) return directPhoto;

  const animalId = match?.animalId || match?.petId || match?.id;
  if (animalId) {
    try {
      const response = await fetch(`${API_BASE_URL}/public/pets/${encodeURIComponent(animalId)}`);
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const pet = data.pet || data.animal || data;
        return getAnimalPhotoUrl(pet) || getAnimalFallbackPhoto(pet);
      }
    } catch (error) {
      console.warn("Unable to load top match photo:", error);
    }
  }

  return getAnimalFallbackPhoto(match);
}

/* ── Init ─────────────────────────────────────────── */
function revealInitializedQuiz() {
  document.body.classList.remove("quiz-initializing");
}

async function initializeQuiz() {
  const access = document.getElementById("quizAccessCard");
  try {
    await ensureUserSession();
  } catch (error) {
    document.getElementById("questionArea").hidden = true;
    document.querySelector(".quiz-phase-nav")?.setAttribute("hidden", "");
    access.hidden = false;
    access.innerHTML = `<h2>Unable to check your quiz status</h2><p>${String(error.message || "Please try again.").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p><a href="/pages/public/home.html">Back to home</a>`;
    revealInitializedQuiz();
    return;
  }
  document.body.classList.remove("quiz-locked-result");
  access?.classList.remove("quiz-retake-note");

  const accountRole = String(getUserSession()?.role || "").trim().toLowerCase();
  if (!hasUserSession() || accountRole !== "public") {
    window.location.replace("/pages/public/home.html#login");
    return;
  }

  await syncQueuedQuizSubmissions();

  const pendingResult = JSON.parse(localStorage.getItem(QUIZ_PENDING_RESULT_KEY) || "null");
  if (pendingResult?.quizData && pendingResult?.result) {
    storeQuizResult(pendingResult.quizData, pendingResult.result);
    localStorage.removeItem(QUIZ_PENDING_RESULT_KEY);
  }

  try {
    const [response] = await Promise.all([
      fetch(`${API_BASE_URL}/match/eligibility`, { credentials: "include" }),
      loadQuestionConfiguration().catch((error) => {
        console.warn("Using bundled quiz questions:", error.message);
      }),
    ]);
    const info = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(info.message || "Please log in again.");
    if (!info.canTakeQuiz) {
      document.body.classList.add("quiz-locked-result");
      document.getElementById("questionArea").hidden = true;
      document.querySelector(".quiz-phase-nav")?.setAttribute("hidden", "");
      access.hidden = false;
      const result = info.latestResult || {};
      const top = result.matches?.[0] || {};
      const topPhoto = await resolveTopMatchPhoto(top);
      const nextDate = info.nextRetakeAt ? new Date(info.nextRetakeAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "To be announced";
      const completedDate = info.lastCompletedAt ? new Date(info.lastCompletedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "Saved to your account";
      const safe = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
      const traitLabels = {
        energyLevel:"Energy", exerciseNeeds:"Exercise", independenceLevel:"Independence",
        attentionNeeds:"Attention", playfulness:"Playfulness", adaptability:"Routine stability",
        friendlinessToHumans:"Friendliness", goodWithKids:"Kids", goodWithOtherPets:"Other pets",
        strangerTolerance:"Strangers", noiseLevel:"Noise", spaceNeeds:"Living space",
        climateTolerance:"Climate readiness", groomingNeeds:"Grooming commitment",
        trainingDifficulty:"Training commitment",
        healthRiskLevel:"Vet budget", affectionLevel:"Affection", separationAnxiety:"Clinginess tolerance"
      };
      const preferences = result.preferences || {};
      const traitPercent = (value) => Math.max(0, Math.min(100, Number(value) * 20));
      const renderTrait = (key) => {
        if (preferences[key] === undefined || preferences[key] === null || preferences[key] === "") return "";
        return `<div class="saved-trait"><span>${safe(traitLabels[key] || key)}</span><div><i style="width:${traitPercent(preferences[key])}%"></i></div><b>${safe(preferences[key])}/5</b></div>`;
      };
      const traitGroups = [
        { title: "Lifestyle", icon: "bi-house-door", keys: ["energyLevel", "exerciseNeeds", "independenceLevel", "adaptability", "climateTolerance"] },
        { title: "Social & Behavior", icon: "bi-people", keys: ["friendlinessToHumans", "goodWithKids", "goodWithOtherPets", "strangerTolerance", "noiseLevel", "affectionLevel", "separationAnxiety", "playfulness"] },
        { title: "Care & Resources", icon: "bi-shield-check", keys: ["attentionNeeds", "spaceNeeds", "groomingNeeds", "trainingDifficulty", "healthRiskLevel"] }
      ];
      const traitCards = traitGroups.map((group) => {
        const rows = group.keys.map(renderTrait).join("");
        return rows ? `<article class="saved-trait-card"><h4><i class="bi ${group.icon}"></i>${safe(group.title)}</h4>${rows}</article>` : "";
      }).join("");
      const hasSavedResult = Boolean(result.matches?.length || Object.keys(preferences).length);
      const remainingDays = Number(info.remainingDays || 0);
      const remainingPercent = Math.max(0, Math.min(100, (remainingDays / 30) * 100));
      const scoreValue = Math.max(0, Math.min(100, Number(top.compatibilityPercent || top.matchPercent || top.score || 0)));
      const score = scoreValue.toFixed(1);
      if (info.reason === "QUIZ_DISABLED" && !hasSavedResult) {
        access.innerHTML = `<section class="saved-result-state is-disabled"><a class="locked-result-home-link" href="/pages/public/home.html"><i class="bi bi-house-door"></i>Back to home</a><div class="saved-state-icon"><i class="bi bi-pause-circle"></i></div><span class="saved-state-kicker">Compatibility matching</span><h1>Quiz temporarily unavailable</h1><p>The shelter has paused new compatibility attempts. Please check again later.</p><div class="saved-result-actions"><a href="/pages/public/my-submissions.html"><i class="bi bi-person-circle"></i>View my account</a></div></section>`;
      } else {
      const optimizedTopPhoto = optimizedPublicImageUrl(topPhoto, 720) || topPhoto;
      access.innerHTML = `<section class="saved-result-state ${info.reason === "QUIZ_DISABLED" ? "is-break" : ""}"><header><div><span class="saved-state-kicker">Compatibility result saved</span><h1>Your best matches are waiting.</h1><p>Your recommendation is stored securely in your ANIMUA account until your next quiz attempt.</p></div><a class="locked-result-home-link" href="/pages/public/home.html"><i class="bi bi-house-door"></i>Back to home</a></header><div class="saved-result-dashboard"><aside class="saved-date-stack"><article><span><i class="bi bi-check2-circle"></i></span><div><small>Completed</small><strong>${safe(completedDate)}</strong></div></article><article><span><i class="bi bi-calendar2-week"></i></span><div><small>Next allowed retake</small><strong>${safe(nextDate)}</strong></div></article><p><i class="bi bi-clock-history"></i><b>${remainingDays} day${remainingDays === 1 ? "" : "s"} remaining</b><em><i style="width:${remainingPercent}%"></i></em></p><div class="saved-result-actions"><a href="/pages/public/compatibilityResults.html"><i class="bi bi-stars"></i>View full results</a><a class="is-secondary" href="/pages/public/find-furbabies.html"><i class="bi bi-heart"></i>Adopt now</a></div></aside><main class="saved-result-main"><article class="saved-top-match"><span class="saved-match-label"><i class="bi bi-award"></i>Top recommendation</span><div class="saved-match-body"><img class="saved-match-photo" src="${safe(optimizedTopPhoto)}" data-original-src="${safe(topPhoto)}" alt="${safe(top.animalName || "Recommended animal")}" loading="eager" decoding="async" fetchpriority="high"><div><small>Best match</small><h2>${safe(top.animalName || "Your saved shelter match")}</h2><p>Based on your lifestyle and care preferences</p></div><strong style="--score-percent:${scoreValue}">${score}<small>%</small></strong></div></article>${traitCards ? `<section class="saved-trait-profile"><div class="saved-profile-heading"><span><i class="bi bi-person-circle"></i></span><div><span class="saved-state-kicker">Your profile</span><h3>Compatibility analysis based on your quiz responses.</h3></div></div><div class="saved-trait-grid">${traitCards}</div></section>` : ""}<footer><i class="bi bi-calendar-event"></i>You can take the quiz again beginning <strong>${safe(nextDate)}</strong>.</footer></main></div></section>`;
      access.querySelector(".saved-match-photo")?.addEventListener("error", (event) => {
        const image = event.currentTarget;
        const originalSrc = image.dataset.originalSrc || "";
        image.dataset.originalSrc = "";
        if (originalSrc && image.src !== originalSrc) image.src = originalSrc;
      });
      }
      if (info.latestResult) sessionStorage.setItem("animua_saved_result", JSON.stringify(info.latestResult));
      revealInitializedQuiz();
      return;
    }
    if (info.hasPreviousResult) {
      access.hidden = false;
      access.classList.add("quiz-retake-note");
      access.innerHTML = `<strong>${getUiCopy("retakeTitle")}</strong><span>${getUiCopy("retakeText")}</span>`;
      document.getElementById("questionArea").hidden = false;
      document.querySelector(".quiz-phase-nav")?.removeAttribute("hidden");
    }
    restoreQuizDraft();
    renderPhase(currentPhase); updateProgress();
    revealInitializedQuiz();
  } catch (error) {
    if (isNetworkError(error) && hasUserSession()) {
      await loadQuestionConfiguration().catch((configError) => {
        console.warn("Using bundled quiz questions while offline:", configError.message);
      });
      restoreQuizDraft();
      access.hidden = false;
      access.classList.add("quiz-retake-note");
      access.innerHTML = `<strong>Offline quiz mode</strong><span>Your answers will be saved on this device and synced when internet returns.</span>`;
      document.getElementById("questionArea").hidden = false;
      document.querySelector(".quiz-phase-nav")?.removeAttribute("hidden");
      renderPhase(currentPhase);
      updateProgress();
      revealInitializedQuiz();
      return;
    }
    document.getElementById("questionArea").hidden = true; access.hidden = false;
    access.innerHTML = `<h2>Unable to open the quiz</h2><p>${error.message}</p><a href="/pages/public/home.html#login">Log in again</a>`;
    revealInitializedQuiz();
  }
}
updateLanguageToggle();
initializeQuiz();
window.addEventListener("online", syncQueuedQuizSubmissions);

document.querySelectorAll("[data-quiz-language]").forEach((button) => {
  button.addEventListener("click", () => {
    const nextLanguage = button.dataset.quizLanguage === "tagalog" ? "tagalog" : "english";
    if (quizLanguage === nextLanguage) return;
    quizLanguage = nextLanguage;
    localStorage.setItem(QUIZ_LANGUAGE_KEY, quizLanguage);
    updateLanguageToggle();
    if (!document.getElementById("questionArea")?.hidden) {
      renderPhase(currentPhase);
      updateProgress();
    }
  });
});

function openConfirmModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("confirm-open");
  modal.querySelector("[data-confirm-close], a, button")?.focus();
}

function closeConfirmModal(modal) {
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("confirm-open");
}

document.getElementById("exitQuizLink")?.addEventListener("click", (event) => {
  event.preventDefault();
  openConfirmModal("exitQuizModal");
});

document.querySelectorAll("[data-confirm-close]").forEach((button) => {
  button.addEventListener("click", () => closeConfirmModal(button.closest(".quiz-confirm-overlay")));
});

document.querySelectorAll(".quiz-confirm-overlay").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeConfirmModal(modal);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const openModal = document.querySelector(".quiz-confirm-overlay:not(.hidden)");
  if (openModal) closeConfirmModal(openModal);
});
