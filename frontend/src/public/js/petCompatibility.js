import { API_BASE_URL } from "/src/utils/api.js";

/* ══════════════════════════════════════════════════════
   QUIZ DEFINITION
   Phase 0: Filters (5 questions — select tiles)
   Phases 1-4: Lifestyle / Social / Home / Affection (19 questions — 1-5 scale)
══════════════════════════════════════════════════════ */
const PHASES = [
  {
    id: 0, key: "filters", label: "Basic Filters",
    icon: "bi-funnel-fill", iconBg: "#fdf0f0", iconColor: "var(--clay)",
    kicker: "Step 1 of 5", title: "Set your filters",
    desc: "Narrow down the pet pool before matching begins.",
    questions: [
      {
        key: "preferredSpecies", label: "Preferred Species", isFilter: true,
        text: "What species are you interested in?",
        hint: "Select any if you have no preference.",
        type: "tiles",
        options: [
          { label:"Any", value:"Any", icon:"🐾" },
          { label:"Dog", value:"Dog", icon:"🐶" },
          { label:"Cat", value:"Cat", icon:"🐱" },
        ]
      },
      {
        key: "preferredSex", label: "Preferred Sex", isFilter: true,
        text: "Do you have a sex preference?",
        hint: "This filters the matching pool — choose Any if undecided.",
        type: "tiles",
        options: [
          { label:"Any", value:"Any", icon:"🔀" },
          { label:"Male", value:"Male", icon:"♂" },
          { label:"Female", value:"Female", icon:"♀" },
        ]
      },
      {
        key: "needAllergyFriendly", label: "Allergy-Friendly", isFilter: true,
        text: "Does anyone in your household have pet allergies?",
        hint: "We'll prioritize hypoallergenic or low-shedding animals.",
        type: "toggle",
        options: [
          { label:"No, no allergies", value:"no", icon:"bi-x-circle" },
          { label:"Yes, need allergy-friendly", value:"yes", icon:"bi-shield-check" },
        ]
      },
      {
        key: "acceptAggressive", label: "Behavioral Challenges", isFilter: true,
        text: "Can you handle a pet with behavioral challenges?",
        hint: "This includes pets that may require extra patience or training.",
        type: "toggle",
        options: [
          { label:"No, I prefer easy-going", value:"no", icon:"bi-emoji-smile" },
          { label:"Yes, I'm experienced", value:"yes", icon:"bi-award" },
        ]
      },
      {
        key: "acceptSpecialNeeds", label: "Special Needs", isFilter: true,
        text: "Are you open to adopting a special-needs pet?",
        hint: "Medical, physical, or behavioral care needs.",
        type: "toggle",
        options: [
          { label:"Not at this time", value:"no", icon:"bi-x-circle" },
          { label:"Yes, open to it", value:"yes", icon:"bi-heart-fill" },
        ]
      },
    ]
  },
  {
    id: 1, key: "lifestyle", label: "Lifestyle",
    icon: "bi-lightning-charge-fill", iconBg: "#e6f7f7", iconColor: "var(--teal)",
    kicker: "Step 2 of 5", title: "Lifestyle & activity",
    desc: "These questions reflect your daily routine, energy, and attention.",
    questions: [
      { key:"energyLevel",       label:"Energy Level",       text:"How energetic do you want your pet to be?",            hint:"Think about your own daily activity level at home.", scale:["Very calm","Low energy","Moderate","Active","Very energetic"] },
      { key:"exerciseNeeds",     label:"Exercise Capacity",  text:"How much daily exercise can you realistically provide?",hint:"Walks, playtime, outdoor runs — be honest about your routine.", scale:["Very little","A little","Moderate","A lot","Very high"] },
      { key:"independenceLevel", label:"Independence",       text:"How independent should your pet be?",                  hint:"Some pets are fine alone for hours; others need constant company.", scale:["Needs constant companionship","Low independence","Balanced","Quite independent","Very independent"] },
      { key:"attentionNeeds",    label:"Attention Capacity", text:"How much daily attention can you give your pet?",       hint:"Bonding time, supervision, interaction — not just feeding.", scale:["Very little","A little","Moderate","A lot","Very high"] },
      { key:"playfulness",       label:"Playfulness",        text:"How playful do you want your pet to be?",              hint:"Do you want a couch companion or an active play partner?", scale:["Very calm","Slightly playful","Balanced","Playful","Very playful"] },
      { key:"adaptability",      label:"Routine Stability",  text:"How often does your daily routine change?",            hint:"Frequent travel, irregular schedules, or moving affects pet wellbeing.", scale:["Very stable","Slightly changing","Moderate changes","Often changing","Very unpredictable"] },
    ]
  },
  {
    id: 2, key: "social", label: "Social Environment",
    icon: "bi-people-fill", iconBg: "#fff8e6", iconColor: "var(--amber)",
    kicker: "Step 3 of 5", title: "Social environment",
    desc: "These questions measure how social and busy your home is.",
    questions: [
      { key:"friendlinessToHumans", label:"Household Sociability",  text:"How social is your household overall?",                     hint:"Think about guests, family gatherings, and daily human activity.", scale:["Very quiet","Slightly social","Moderately social","Social","Very social"] },
      { key:"goodWithKids",         label:"Kids at Home",           text:"How often will your pet interact with children?",            hint:"Daily kids = high importance; no kids = set this to 1.", scale:["Never","Rarely","Sometimes","Often","Daily — it's a must"] },
      { key:"goodWithOtherPets",    label:"Other Pets",             text:"Will your pet live with or interact with other pets?",       hint:"Multi-pet households need pets with high compatibility scores.", scale:["No other pets","Rare contact","Sometimes","Often","Yes, definitely"] },
      { key:"strangerTolerance",    label:"Visitor Comfort",        text:"How comfortable should your pet be around visitors or strangers?", hint:"If guests visit often, a welcoming pet makes life easier.", scale:["Very cautious","Reserved","Balanced","Friendly","Very welcoming"] },
    ]
  },
  {
    id: 3, key: "care", label: "Home & Care",
    icon: "bi-house-heart-fill", iconBg: "#e8f7ee", iconColor: "var(--green)",
    kicker: "Step 4 of 5", title: "Home, care & maintenance",
    desc: "These measure your space, grooming capacity, and care tolerance.",
    questions: [
      { key:"noiseLevel",        label:"Noise Tolerance",      text:"How much noise can you comfortably handle from a pet?",      hint:"Barking, meowing, vocalizing — think about your neighbors too.", scale:["Very little","Low","Moderate","High","Very high"] },
      { key:"spaceNeeds",        label:"Living Space",         text:"How much living space can you provide?",                     hint:"Studio apartment vs. house with yard — both are valid.", scale:["Very small (studio)","Small","Average","Large","Very large with yard"] },
      { key:"climateTolerance",  label:"Climate Readiness",    text:"Can you care for a pet in Angeles City's warm climate?",     hint:"Some breeds need more heat management and care in tropical climates.", scale:["Not ready","Slightly ready","Moderately ready","Ready","Fully prepared"] },
      { key:"groomingNeeds",     label:"Grooming Commitment",  text:"How willing are you to groom your pet regularly?",           hint:"Brushing, bathing, trimming — some breeds need much more.", scale:["Not willing","Slightly willing","Moderate effort","Willing","Very willing"] },
      { key:"sheddingLevel",     label:"Shedding Tolerance",   text:"How comfortable are you with pet fur around the house?",     hint:"High-shedding pets require regular vacuuming and lint-rolling.", scale:["Not at all","Slightly OK","Neutral","Comfortable","No problem at all"] },
      { key:"trainingDifficulty",label:"Training Commitment",  text:"How much training difficulty can you handle?",               hint:"Think about your patience, experience, and time for training.", scale:["Very easy only","Low difficulty","Moderate","Can handle difficult","Very experienced trainer"] },
      { key:"healthRiskLevel",   label:"Vet Budget",           text:"How prepared are you for veterinary costs?",                hint:"Unexpected vet bills are part of pet ownership — be realistic.", scale:["Not prepared","Slightly prepared","Somewhat prepared","Prepared","Fully prepared & insured"] },
    ]
  },
  {
    id: 4, key: "affection", label: "Affection",
    icon: "bi-heart-fill", iconBg: "#fdf0f0", iconColor: "var(--clay)",
    kicker: "Step 5 of 5", title: "Affection & attachment",
    desc: "These questions reflect the closeness and bond you want.",
    questions: [
      { key:"affectionLevel",    label:"Affection Preference",  text:"How affectionate do you want your pet to be?",          hint:"Cuddly lap pet vs. independent companion — what fits you?", scale:["Very independent","Not very affectionate","Balanced","Affectionate","Very cuddly"] },
      { key:"separationAnxiety", label:"Clinginess Tolerance",  text:"How comfortable are you with a clingy pet?",             hint:"Some pets get stressed when left alone — can you manage that?", scale:["Not comfortable","Slightly OK","Neutral","Comfortable","Completely fine with it"] },
    ]
  }
];

const PHASE_TIPS = [
  "These filters narrow down the pet pool — so your quiz answers match the right animals.",
  "Be honest about your actual daily routine, not your ideal version of it.",
  "Consider your whole household — kids, roommates, and other pets all matter.",
  "Think about your current home setup, not a future dream home.",
  "The bond you want with your pet is just as important as practical needs.",
];

/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let answers     = {};
let currentPhase= 0;
const totalQ    = PHASES.reduce((s,p) => s+p.questions.length, 0);

/* ══════════════════════════════════════════════════════
   RENDER
══════════════════════════════════════════════════════ */
function renderPhase(phaseIdx) {
  const phase = PHASES[phaseIdx];
  const area  = document.getElementById("questionArea");

  // Update sidebar tip
  document.getElementById("tipText").textContent  = PHASE_TIPS[phaseIdx];
  document.getElementById("phaseBadge").textContent= phase.label;

  // Update phase steps in sidebar
  document.querySelectorAll(".phase-step").forEach((el, i) => {
    el.classList.remove("active","done");
    if (i < phaseIdx)  el.classList.add("done");
    if (i === phaseIdx) el.classList.add("active");
    // update dot icon
    const dot = el.querySelector(".phase-step-dot");
    if (i < phaseIdx) dot.innerHTML = `<i class="bi bi-check2" style="font-size:0.7rem"></i>`;
  });

  let html = `
    <div class="phase-intro slide-in">
      <div class="phase-intro-icon" style="background:${phase.iconBg};color:${phase.iconColor}">
        <i class="bi ${phase.icon}"></i>
      </div>
      <div>
        <div class="phase-intro-kicker">${phase.kicker}</div>
        <div class="phase-intro-title">${phase.title}</div>
        <div class="phase-intro-desc">${phase.desc}</div>
      </div>
    </div>`;

  phase.questions.forEach((q, qi) => {
    const globalIdx = PHASES.slice(0, phaseIdx).reduce((s,p) => s+p.questions.length,0) + qi + 1;
    const answered  = answers[q.key] !== undefined;

    if (q.type === "tiles") {
      html += `
        <div class="filter-section slide-in ${answered?"answered":""}" data-key="${q.key}" style="animation-delay:${qi*40}ms">
          <div class="q-num">Question ${globalIdx}</div>
          <div class="q-text">${q.text}</div>
          <div class="q-hint">${q.hint}</div>
          <div class="select-tiles">
            ${q.options.map(opt => `
              <div class="select-tile ${answers[q.key]===opt.value?"selected":""}"
                   data-key="${q.key}" data-value="${opt.value}">
                <div class="select-tile-icon">${opt.icon}</div>
                <div class="select-tile-label">${opt.label}</div>
              </div>`).join("")}
          </div>
        </div>`;
    } else if (q.type === "toggle") {
      html += `
        <div class="filter-section slide-in ${answered?"answered":""}" data-key="${q.key}" style="animation-delay:${qi*40}ms">
          <div class="q-num">Question ${globalIdx}</div>
          <div class="q-text">${q.text}</div>
          <div class="q-hint">${q.hint}</div>
          <div class="toggle-group">
            ${q.options.map(opt => `
              <div class="toggle-tile ${answers[q.key]===opt.value?(opt.value==="yes"?"selected-yes":"selected-no"):""}"
                   data-key="${q.key}" data-value="${opt.value}">
                <i class="bi ${opt.icon}"></i>${opt.label}
              </div>`).join("")}
          </div>
        </div>`;
    } else {
      // 1-5 scale
      html += `
        <div class="question-card slide-in ${answered?"answered":""}" data-key="${q.key}" style="animation-delay:${qi*40}ms">
          <div class="q-num">Question ${globalIdx}</div>
          <div class="q-text">${q.text}</div>
          <div class="q-hint">${q.hint}</div>
          <div class="option-group">
            ${q.scale.map((lbl, val) => `
              <button class="option-btn ${answers[q.key]===(val+1)?"selected":""}"
                      data-key="${q.key}" data-value="${val+1}" type="button">
                <span class="option-num">${val+1}</span>
                <span class="option-label">${lbl}</span>
              </button>`).join("")}
          </div>
        </div>`;
    }
  });

  // Navigation
  const isLast = phaseIdx === PHASES.length - 1;
  html += `
    <div class="quiz-nav slide-in" style="animation-delay:${phase.questions.length*40+40}ms">
      <button class="btn-prev" id="btnPrev" ${phaseIdx===0?"disabled":""}>
        <i class="bi bi-arrow-left"></i> Previous
      </button>
      ${isLast
        ? `<button class="btn-submit" id="btnSubmit" type="button">
             <i class="bi bi-stars"></i> Find My Matches
           </button>`
        : `<button class="btn-next" id="btnNext" type="button">
             Next <i class="bi bi-arrow-right"></i>
           </button>`
      }
    </div>`;

  area.innerHTML = html;

  // Bind events
  area.querySelectorAll(".option-btn, .select-tile, .toggle-tile").forEach(el => {
    el.addEventListener("click", () => handleAnswer(el.dataset.key, el.dataset.value));
  });

  document.getElementById("btnPrev")?.addEventListener("click", () => {
    if (currentPhase > 0) { currentPhase--; renderPhase(currentPhase); updateProgress(); }
  });

  document.getElementById("btnNext")?.addEventListener("click", () => {
    if (currentPhase < PHASES.length - 1) {
      currentPhase++;
      renderPhase(currentPhase);
      updateProgress();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  document.getElementById("btnSubmit")?.addEventListener("click", handleSubmit);

  // Set defaults for filter questions if not yet answered
  PHASES[phaseIdx].questions.forEach(q => {
    if (q.type === "tiles" && answers[q.key] === undefined) {
      handleAnswer(q.key, q.options[0].value, true);
    }
    if (q.type === "toggle" && answers[q.key] === undefined) {
      handleAnswer(q.key, q.options[0].value, true);
    }
  });
}

function handleAnswer(key, value, silent = false) {
  const wasAnswered = answers[key] !== undefined;
  answers[key] = isNaN(value) ? value : Number(value);

  if (!silent) {
    // Update the clicked element visually
    const card = document.querySelector(`[data-key="${key}"]`)?.closest(".question-card, .filter-section");
    if (card) card.classList.add("answered");

    // Deselect siblings
    document.querySelectorAll(`[data-key="${key}"]`).forEach(el => {
      el.classList.remove("selected","selected-yes","selected-no");
    });

    // Select clicked
    const clicked = document.querySelector(`[data-key="${key}"][data-value="${value}"]`);
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
}

function updateProgress() {
  const pct = Math.round((Object.keys(answers).length / totalQ) * 100);
  document.getElementById("progressFill").style.width  = pct + "%";
  document.getElementById("progressPercent").textContent= pct + "%";

  // Count answered in all phases
  let done = 0, total = 0;
  PHASES.forEach(p => { p.questions.forEach(() => total++); });
  Object.keys(answers).forEach(() => done++);
  document.getElementById("progressLabel").textContent = `${done} of ${total} answered`;
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
    return `<div class="answer-chip"><span class="answer-chip-key">${label}</span><span class="answer-chip-val">${v}</span></div>`;
  }).join("");
}

async function handleSubmit() {
  // Build quiz data structure matching existing petCompatibility.js format
  const quizData = {
    filters: {
      preferredSpecies:    answers.preferredSpecies    || "Any",
      preferredSex:        answers.preferredSex        || "Any",
      needAllergyFriendly: answers.needAllergyFriendly || "no",
      acceptAggressive:    answers.acceptAggressive    || "yes",
      acceptSpecialNeeds:  answers.acceptSpecialNeeds  || "yes",
    },
    preferences: {
      energyLevel:          answers.energyLevel         || 3,
      exerciseNeeds:        answers.exerciseNeeds        || 3,
      independenceLevel:    answers.independenceLevel    || 3,
      attentionNeeds:       answers.attentionNeeds       || 3,
      playfulness:          answers.playfulness          || 3,
      friendlinessToHumans: answers.friendlinessToHumans || 3,
      goodWithKids:         answers.goodWithKids         || 3,
      goodWithOtherPets:    answers.goodWithOtherPets    || 3,
      strangerTolerance:    answers.strangerTolerance    || 3,
      noiseLevel:           answers.noiseLevel           || 3,
      spaceNeeds:           answers.spaceNeeds           || 3,
      adaptability:         answers.adaptability         || 3,
      climateTolerance:     answers.climateTolerance     || 3,
      groomingNeeds:        answers.groomingNeeds        || 3,
      sheddingLevel:        answers.sheddingLevel        || 3,
      trainingDifficulty:   answers.trainingDifficulty   || 3,
      healthRiskLevel:      answers.healthRiskLevel      || 3,
      affectionLevel:       answers.affectionLevel       || 3,
      separationAnxiety:    answers.separationAnxiety    || 3,
    }
  };

  // Show completion screen
  document.getElementById("quizMain").style.display   = "none";
  document.getElementById("completionScreen").style.display = "flex";

  // Build summary chips
  const summary = document.getElementById("completeSummary");
  const highlights = [
    { label:"Species", val: quizData.filters.preferredSpecies },
    { label:"Energy",  val: quizData.preferences.energyLevel + "/5" },
    { label:"Space",   val: quizData.preferences.spaceNeeds + "/5" },
    { label:"Allergy-safe", val: quizData.filters.needAllergyFriendly==="yes"?"Yes":"No" },
  ];
  summary.innerHTML = highlights.map(h => `<div class="score-pill">${h.label}: <strong>${h.val}</strong></div>`).join("");

  console.log("Quiz data:", quizData);

  try {
    const animals  = await fetchAnimals();
    const filtered = applyFilters(animals, quizData.filters);
    const matched  = scoreAnimals(filtered, quizData.preferences);

    localStorage.setItem("animua_quiz_data",      JSON.stringify(quizData));
    localStorage.setItem("animua_match_results",  JSON.stringify(matched));

    document.getElementById("viewResultsBtn").onclick = () => {
      window.location.href = "/pages/public/compatibilityResults.html";
    };
  } catch(err) {
    console.error("Matching failed:", err);
    document.getElementById("completionScreen").innerHTML = `
      <div class="complete-card">
        <span class="complete-icon">😕</span>
        <h2 class="complete-title">Something went wrong</h2>
        <p class="complete-sub">We couldn't fetch pet data right now. Please try again later.</p>
        <button class="btn-submit" onclick="window.location.href='/pages/public/quizLanding.html'">Back to Quiz</button>
      </div>`;
  }
}

async function fetchAnimals() {
  const response = await fetch(`${API_BASE_URL}/public/pets`);

  if (!response.ok) {
    throw new Error("Failed to fetch pet records.");
  }

  const data = await response.json();
  console.log("RAW PETS:", data);

  const pets = Array.isArray(data) ? data : data.pets || data.animals || [];

  const normalizedPets = pets.map((pet) => ({
    ...pet,
    ...(pet.behavioralAssessment || {}), // 🔥 THIS IS THE KEY FIX
    photoUrl: pet.photoURL || pet.photoUrl || "",
    age: pet.ageEstimate || ""
  }));

  console.log("NORMALIZED PETS:", normalizedPets);
  console.log("CHECK ONE:", normalizedPets[0]);

  return normalizedPets;
}

/* ── API ──────────────────────────────────────────── */
function applyFilters(animals, filters) {
  return animals.filter((animal) => {
    const isAdoptable =
      animal.status === "Ready" || animal.status === "Ready for Adoption";

    if (!isAdoptable) return false;

    const speciesMatch =
      !filters.preferredSpecies ||
      filters.preferredSpecies === "Any" ||
      String(animal.species || "").toLowerCase() ===
        String(filters.preferredSpecies).toLowerCase();

    if (!speciesMatch) return false;

    const sexMatch =
    !filters.preferredSex ||
    filters.preferredSex === "Any" ||
    animal.sex === "Unknown" || // ✅ allow unknown
    String(animal.sex || "").toLowerCase() ===
      String(filters.preferredSex).toLowerCase();

    if (!sexMatch) return false;

    // Only enforce if the field exists
    if (
      filters.needAllergyFriendly === "yes" &&
      animal.allergyFriendly !== undefined &&
      animal.allergyFriendly !== true
    ) {
      return false;
    }

    if (
      filters.acceptAggressive === "no" &&
      animal.aggressive !== undefined &&
      Number(animal.aggressive) >= 5
    ) {
      return false;
    }

    if (
      filters.acceptSpecialNeeds === "no" &&
      animal.specialNeeds !== undefined &&
      Number(animal.specialNeeds) >= 4
    ) {
      return false;
    }

    return true;
  });
}

const SCORE_KEYS = [
  "energyLevel",
  "exerciseNeeds",
  "independenceLevel",
  "attentionNeeds",
  "playfulness",
  "friendlinessToHumans",
  "goodWithKids",
  "goodWithOtherPets",
  "strangerTolerance",
  "noiseLevel"
];

function scoreAnimals(animals, preferences) {
  const userVector = SCORE_KEYS.map((key) => Number(preferences[key] ?? 3));
  
  console.log("User Vector:", userVector);
console.log("Animals to score:", animals);

  return animals
    .map((animal) => {
      const petVector = SCORE_KEYS.map((key) => Number(animal[key] ?? 3));
      const cosine = cosineSimilarity(userVector, petVector);

      // NEW: distance penalty
      let diff = 0;
      for (let i = 0; i < userVector.length; i++) {
        diff += Math.abs(userVector[i] - petVector[i]);
      }

      const maxDiff = userVector.length * 4; // max difference per trait = 4
      const penalty = diff / maxDiff;

      const similarity = cosine * (1 - penalty);
      const matchPercent = similarity * 100;

      console.log("Scoring pet:", animal.name, petVector);

      return {
        ...animal,
        matchScore: Number(similarity.toFixed(4)),
        matchPercent: Number(matchPercent.toFixed(2))
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

function cosineSimilarity(vectorA, vectorB) {
  const dot = dotProduct(vectorA, vectorB);
  const magA = magnitude(vectorA);
  const magB = magnitude(vectorB);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (magA * magB);
}

function dotProduct(vectorA, vectorB) {
  let total = 0;

  for (let i = 0; i < vectorA.length; i++) {
    total += vectorA[i] * vectorB[i];
  }

  return total;
}

function magnitude(vector) {
  let sum = 0;

  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }

  return Math.sqrt(sum);
}

/* ── Init ─────────────────────────────────────────── */
renderPhase(0);
updateProgress();
