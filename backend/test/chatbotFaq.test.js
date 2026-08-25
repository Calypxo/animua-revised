process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-animua-test";

const test = require("node:test");
const assert = require("node:assert/strict");

const { _test } = require("../src/controllers/chatbotController");

const samplePets = [
  {
    id: "dog-1",
    name: "ANM-001",
    species: "Dog",
    breed: "Aspin",
    sex: "Female",
    age: "2 years",
    color: "Black"
  },
  {
    id: "cat-1",
    name: "ANM-002",
    species: "Cat",
    breed: "Puspin",
    sex: "Male",
    age: "1 year",
    color: "Orange"
  }
];

const sampleEvents = [
  {
    id: "event-1",
    title: "Free Anti-Rabies Vaccination Drive",
    date: "2026-08-20T09:00:00.000Z",
    time: "9:00 AM - 3:00 PM",
    location: "Angeles City Hall",
    description: "Free anti-rabies vaccination for local pets.",
    status: "Published"
  }
];

test("answers Tagalog adoptable animal availability questions with the live list", () => {
  const message = "sino ang mga pwedeng iadapt?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), true);
  assert.equal(_test.hasAnimalAvailabilityIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: samplePets, events: [] }, "tagalog");

  assert.match(reply, /Narito ang animals/i);
  assert.match(reply, /ANM-001/);
  assert.match(reply, /ANM-002/);
  assert.match(reply, /Find Furbabies/);
});

test("answers Tagalog color animal searches with matching Find Furbabies animals", () => {
  const message = "gusto ko ng aso na black";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), true);
  assert.equal(_test.hasAnimalAvailabilityIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: samplePets, events: [] }, "tagalog");

  assert.match(reply, /Find Furbabies/i);
  assert.match(reply, /ANM-001/);
  assert.match(reply, /Black/i);
  assert.doesNotMatch(reply, /ANM-002/);
  assert.doesNotMatch(reply, /Gets ko/i);
});

test("answers Tagalog dog availability questions with Find Furbabies dogs", () => {
  const message = "may mga aso pa po?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), true);
  assert.equal(_test.hasAnimalAvailabilityIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: samplePets, events: [] }, "tagalog");

  assert.match(reply, /Find Furbabies/i);
  assert.match(reply, /ANM-001/);
  assert.doesNotMatch(reply, /ANM-002/);
  assert.doesNotMatch(reply, /Gets ko/i);
});

test("sends pet check-up requests to Contact Us instead of Find Furbabies", () => {
  const message = "pwede po ba pacheck up aso ko?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), false);
  assert.equal(_test.hasCheckupRequestIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: samplePets, events: [] }, "tagalog");

  assert.match(reply, /Walang pet check-up booking feature/i);
  assert.match(reply, /Contact Us/);
  assert.match(reply, /staff/i);
  assert.doesNotMatch(reply, /Find Furbabies/i);
  assert.doesNotMatch(reply, /marked Ready/i);
});

test("sends pet food donation questions to Contact Us staff", () => {
  const message = "pwede po magdonate ng mga dog and cat food?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);

  const reply = _test.getLocalReply(message, { pets: samplePets, events: [] }, "tagalog");

  assert.match(reply, /^Oo\./);
  assert.match(reply, /message ang staff sa Contact Us/i);
  assert.match(reply, /dog food, cat food/i);
  assert.doesNotMatch(reply, /Find Furbabies/i);
  assert.doesNotMatch(reply, /marked Ready/i);
});

test("answers Taglish vaccination questions without falling back", () => {
  const message = "navaccine na ba ang mga aso pusa?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.hasPetCareIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /vaccination/i);
  assert.match(reply, /Find Furbabies/);
  assert.match(reply, /Hindi ko magagarantiya/i);
});

test("answers vaccination schedule questions as events, not animal records", () => {
  const message = "when will the vaccine happen?";

  assert.equal(_test.hasVaccinationScheduleIntent(message), true);
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /do not see a published vaccination/i);
  assert.match(reply, /official confirmation/i);
  assert.doesNotMatch(reply, /adoptable dog or cat/i);
});

test("answers free vaccine questions directly from matching events", () => {
  const message = "may free vaccine po ba?";

  assert.equal(_test.resolveReplyLanguage("english", message), "english");
  assert.equal(_test.hasVaccinationScheduleIntent(message), true);
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: sampleEvents }, "english");

  assert.match(reply, /^Yes\./);
  assert.match(reply, /Free Anti-Rabies Vaccination Drive/);
  assert.match(reply, /Angeles City Hall/);
  assert.match(reply, /marked free/i);
  assert.doesNotMatch(reply, /There are no published upcoming events/i);
});

test("answers Tagalog vaccination schedule questions as events", () => {
  const message = "kailan may bakuna?";

  assert.equal(_test.hasVaccinationScheduleIntent(message), true);
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /Wala akong nakikitang published vaccination/i);
  assert.match(reply, /official confirmation/i);
  assert.doesNotMatch(reply, /adoptable dog o cat/i);
});

test("answers Tagalog free vaccine questions directly from matching events", () => {
  const message = "may free vaccine po ba?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.hasVaccinationScheduleIntent(message), true);
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: sampleEvents }, "tagalog");

  assert.match(reply, /^Oo\./);
  assert.match(reply, /Free Anti-Rabies Vaccination Drive/);
  assert.match(reply, /Angeles City Hall/);
  assert.match(reply, /Marked free\/libre/i);
  assert.doesNotMatch(reply, /Wala pang published upcoming events/i);
});

test("answers adopted animal pickup timing questions", () => {
  const message = "kailan ko pwede kunin ang inadopt ko?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), false);
  assert.equal(_test.hasAdoptionPickupIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /approved na/i);
  assert.match(reply, /pickup instructions/i);
  assert.match(reply, /application updates/i);
});

test("answers adoption step questions instead of listing ready animals", () => {
  const message = "I want to adopt a dog. What do I need to do";

  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), false);
  assert.equal(_test.hasAdoptionProcessIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: samplePets, events: [] }, "english");

  assert.match(reply, /To adopt a dog or cat through ANIMUA/i);
  assert.match(reply, /submit the adoption application/i);
  assert.doesNotMatch(reply, /Here are animals currently marked Ready/i);
});

test("answers non-Angeles adoption eligibility as yes", () => {
  const message = "can I adopt? im from macabebe";

  assert.equal(_test.shouldUseLocalReply(message), true);

  const reply = _test.getLocalReply(message, { pets: samplePets, events: [] }, "english");

  assert.match(reply, /^Yes,|Applicants from inside or outside Angeles City may submit/i);
  assert.match(reply, /inside or outside Angeles City/i);
  assert.match(reply, /evaluated by the Angeles City Veterinary Office/i);
  assert.doesNotMatch(reply, /only for qualified Angeles City residents/i);
});

test("answers Tagalog adoption step questions instead of listing ready animals", () => {
  const message = "Gusto ko mag adopt ng aso, ano gagawin ko?";

  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), false);
  assert.equal(_test.hasAdoptionProcessIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: samplePets, events: [] }, "tagalog");

  assert.match(reply, /Para mag-adopt ng aso o pusa through ANIMUA/i);
  assert.match(reply, /isumite ang adoption application/i);
  assert.doesNotMatch(reply, /Narito ang animals/i);
});

test("answers Tagalog non-Angeles adoption eligibility as allowed", () => {
  const message = "Taga Macabebe ako, pwede ba ako mag adopt?";

  assert.equal(_test.shouldUseLocalReply(message), true);

  const reply = _test.getLocalReply(message, { pets: samplePets, events: [] }, "tagalog");

  assert.match(reply, /Maaaring magsumite ng adoption application/i);
  assert.match(reply, /loob o labas ng Angeles City/i);
  assert.doesNotMatch(reply, /Qualified Angeles City residents lang/i);
});

test("provider prompt includes official FAQ source-of-truth rules", () => {
  const prompt = _test.buildSystemPrompt({ pets: samplePets, events: [] }, "english");

  assert.match(prompt, /Official FAQ rules to follow/i);
  assert.match(prompt, /Do not list ready animals unless the user asks who\/which animals are available/i);
  assert.match(prompt, /sign in and check My Applications/i);
  assert.match(prompt, /only qualified Angeles City residents may submit surrender requests/i);
  assert.match(prompt, /ANIMUA has no stray\/lost reporting feature/i);
  assert.match(prompt, /answer in English even if the user writes Taglish/i);
});

test("official FAQ layer answers system questions before AI is needed", async () => {
  const adoptionReply = await _test.getOfficialFaqReply(
    {},
    "can I adopt? im from macabebe",
    "english"
  );
  const surrenderReply = await _test.getOfficialFaqReply(
    {},
    "Can I surrender if I live in Macabebe?",
    "english"
  );

  assert.match(adoptionReply, /^Yes\./);
  assert.match(adoptionReply, /inside or outside Angeles City/i);
  assert.match(surrenderReply, /^No\./);
  assert.match(surrenderReply, /only for qualified Angeles City residents/i);
});

test("official FAQ layer lets unmatched on-topic wording go to the AI layer", async () => {
  const reply = await _test.getOfficialFaqReply(
    {},
    "Can you explain ANIMUA in a friendly way for my neighbor?",
    "english"
  );

  assert.equal(reply, "");
});

test("answers adoption application approval timing questions", () => {
  const message = "kailan ma aapprove and application ko?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.resolveReplyLanguage("english", message), "english");
  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), false);
  assert.equal(_test.hasAdoptionApprovalTimingIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /Walang guaranteed/i);
  assert.match(reply, /Nire-review/i);
  assert.match(reply, /official status updates/i);
});

test("answers Tagalog multiple adoption application questions directly", () => {
  const message = "Pwede ba akong mag-submit ng dalawang application?";

  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /^Oo\./);
  assert.match(reply, /higit sa isang pet/i);
  assert.match(reply, /ire-review ng shelter/i);
  assert.match(reply, /hindi guaranteed ang approval/i);
  assert.doesNotMatch(reply, /kahit para sa higit sa isang animal/i);
  assert.doesNotMatch(reply, /buksan ang Find Furbabies/i);
});

test("answers Tagalog more-than-one pet adoption questions directly", () => {
  const message = "Pwede ba mag-adopt ng higit sa isang pet?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), false);
  assert.equal(_test.hasAdoptionQuantityIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /^Oo\./);
  assert.match(reply, /higit sa isang pet/i);
  assert.match(reply, /ire-review ng shelter/i);
  assert.doesNotMatch(reply, /pumunta sa Find Furbabies/i);
});

test("answers three adoption application questions directly", () => {
  const message = "Pwede ba akong mag-submit ng tatlong application?";

  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /^Oo\./);
  assert.match(reply, /higit sa isang pet/i);
  assert.doesNotMatch(reply, /buksan ang Find Furbabies/i);
});

test("answers Match Quiz questions concisely", () => {
  const message = "Is the compatibility quiz accurate?";

  assert.equal(_test.shouldUseLocalReply(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /Match Quiz gives compatibility suggestions/i);
  assert.match(reply, /guide only/i);
  assert.match(reply, /final decision/i);
  assert.ok(reply.length < 260);
});

test("routes application status questions to My Applications instead of animal visits", () => {
  const message = "Where can I see my adoption application status?";

  assert.equal(_test.resolveReplyLanguage("english", message), "english");
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.hasVisitAnimalIntent(message), false);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /sign in to your ANIMUA account/i);
  assert.match(reply, /official updates/i);
  assert.doesNotMatch(reply, /visiting or meeting an animal/i);
});

test("still answers real animal visit questions as meet-and-greet guidance", () => {
  const message = "Can I meet the animal before adoption?";

  assert.equal(_test.hasVisitAnimalIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /visiting or meeting an animal/i);
});

test("answers non-Angeles surrender eligibility even with typo phrasing", () => {
  const message = "Can I surrender when im not froma angeles city?";

  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.hasOutsideAngelesIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /No\. ANIMUA surrender requests are only for qualified Angeles City residents/i);
  assert.match(reply, /local city or municipal veterinary office/i);
  assert.doesNotMatch(reply, /open the Surrender page and complete the form/i);
});

test("answers Tagalog non-Angeles surrender eligibility for Macabebe residents", () => {
  const message = "taga macabebe ako pwede ako mag surrender?";

  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.hasOutsideAngelesIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /^Hindi\./);
  assert.match(reply, /qualified Angeles City residents/i);
  assert.match(reply, /taga-ibang lungsod o munisipyo/i);
  assert.match(reply, /local city o municipal veterinary office/i);
  assert.doesNotMatch(reply, /buksan ang Surrender page/i);
});

test("answers English non-Angeles surrender eligibility for live-in phrasing", () => {
  const message = "Can I surrender if I live in Macabebe?";

  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.hasOutsideAngelesIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /^No\./);
  assert.match(reply, /only for qualified Angeles City residents/i);
  assert.match(reply, /another city or municipality/i);
  assert.doesNotMatch(reply, /open the Surrender page/i);
});

test("answers common public FAQ questions in English and Tagalog", () => {
  const faqCases = [
    {
      message: "Can I use ANIMUA without an account?",
      language: "english",
      expected: [/browse public ANIMUA pages/i, /need to sign in or create an account/i]
    },
    {
      message: "Pwede ba walang account kapag mag submit ng adoption?",
      language: "tagalog",
      expected: [/Maaari mong tingnan ang public ANIMUA pages/i, /kailangan mong mag-sign in/i]
    },
    {
      message: "Can I edit my adoption application if I made a mistake?",
      language: "english",
      expected: [/open My Applications/i, /contact the Angeles City Veterinary Office/i]
    },
    {
      message: "Mali ang details sa application ko, paano ayusin?",
      language: "tagalog",
      expected: [/My Applications/i, /kailangang itama/i]
    },
    {
      message: "Why was my adoption application rejected?",
      language: "english",
      expected: [/official status or remarks/i, /apply again/i]
    },
    {
      message: "Hindi na approve application ko pwede mag apply ulit?",
      language: "tagalog",
      expected: [/hindi na-approve/i, /Maaari kang mag-apply ulit/i]
    },
    {
      message: "Where can I see my pickup schedule?",
      language: "english",
      expected: [/open My Applications/i, /Pickup dates/i]
    },
    {
      message: "Saan makikita ang schedule ng adoption pickup ko?",
      language: "tagalog",
      expected: [/My Applications/i, /pickup dates/i]
    },
    {
      message: "What if I missed my pickup schedule?",
      language: "english",
      expected: [/missed your adoption pickup schedule/i, /office must confirm/i]
    },
    {
      message: "Hindi ako nakapunta sa pickup schedule, ano gagawin?",
      language: "tagalog",
      expected: [/hindi ka nakapunta/i, /kailangan munang kumpirmahin/i]
    },
    {
      message: "Can I reserve this dog?",
      language: "english",
      expected: [/does not guarantee pet reservations/i, /Find Furbabies profile/i]
    },
    {
      message: "Pwede ipa reserve yung pusa?",
      language: "tagalog",
      expected: [/Hindi naggagarantiya/i, /Find Furbabies/i]
    },
    {
      message: "Can a student adopt?",
      language: "english",
      expected: [/student, minor, or dependent/i, /readiness and consent/i]
    },
    {
      message: "Ilang taon dapat para mag adopt?",
      language: "tagalog",
      expected: [/legal at responsableng/i, /guardian o family support/i]
    },
    {
      message: "Where can I see the dog's breed and photos?",
      language: "english",
      expected: [/animal's profile in Find Furbabies/i, /photos, species, age, sex, breed/i]
    },
    {
      message: "Saan makikita ang edad at lahi ng aso?",
      language: "tagalog",
      expected: [/animal profile sa Find Furbabies/i, /age, sex, breed/i]
    },
    {
      message: "I lost my dog, can ANIMUA track it?",
      language: "english",
      expected: [/does not have a lost-pet posting/i, /last-seen location/i]
    },
    {
      message: "Nawala ang pusa ko, saan ako magtatanong?",
      language: "tagalog",
      expected: [/nawawalang pet/i, /last-seen location/i]
    }
  ];

  for (const faq of faqCases) {
    assert.equal(_test.shouldUseLocalReply(faq.message), true, faq.message);
    const reply = _test.getLocalReply(faq.message, { pets: [], events: [] }, faq.language);

    for (const pattern of faq.expected) {
      assert.match(reply, pattern, faq.message);
    }
  }
});

test("answers adoption pickup document questions", () => {
  const message = "What should I bring for pet pickup?";

  assert.equal(_test.hasAdoptionPickupDocumentIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /adoption application details/i);
  assert.match(reply, /valid ID/i);
  assert.match(reply, /My Applications/i);
  assert.match(reply, /pickup schedule/i);
});

test("answers pick-up document questions with separated pick up wording", () => {
  const message = "what should I bring when I pick up the dog";

  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.hasAdoptionPickupDocumentIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /adoption application details/i);
  assert.match(reply, /My Applications/i);
  assert.match(reply, /valid ID/i);
});

test("answers Tagalog adoption pickup document questions", () => {
  const message = "Ano ang dadalhin ko sa pickup?";

  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.hasAdoptionPickupDocumentIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /valid ID/i);
  assert.match(reply, /My Applications/i);
  assert.match(reply, /adoption application details/i);
  assert.match(reply, /nakaiskedyul|nakatakdang date|pickup schedule/i);
});

test("answers adoption pickup reschedule questions", () => {
  const message = "Can I reschedule my pickup?";

  assert.equal(_test.hasAdoptionPickupRescheduleIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /Reschedule/i);
  assert.match(reply, /up to two times/i);
  assert.match(reply, /saved immediately/i);
  assert.match(reply, /without admin approval/i);
  assert.match(reply, /account may be suspended/i);
});

test("answers Tagalog adoption pickup reschedule questions", () => {
  const message = "Pwede bang ilipat ang pickup schedule ko?";

  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.hasAdoptionPickupRescheduleIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /Reschedule/i);
  assert.match(reply, /dalawang beses/i);
  assert.match(reply, /Agad mase-save/i);
  assert.match(reply, /walang admin approval/i);
  assert.match(reply, /maaaring ma-suspend/i);
});

test("answers home preparation questions before adoption", () => {
  const message = "What should I prepare before bringing my adopted pet home?";

  assert.equal(_test.hasAdoptionHomePreparationIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /food and clean water/i);
  assert.match(reply, /safe sleeping area/i);
  assert.match(reply, /veterinary care/i);
});

test("answers Tagalog home preparation questions before adoption", () => {
  const message = "Ano ang ihahanda ko bago iuwi ang adopted pet?";

  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.hasAdoptionHomePreparationIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /pagkain at malinis na tubig/i);
  assert.match(reply, /ligtas na tulugan/i);
  assert.match(reply, /veterinary care/i);
});

test("answers surrender availability questions", () => {
  const message = "Are you accepting surrender requests now?";

  assert.equal(_test.hasSurrenderAvailabilityIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /qualified Angeles City residents/i);
  assert.match(reply, /requests are paused/i);
});

test("answers Tagalog surrender availability questions", () => {
  const message = "Tumatanggap ba kayo ng surrender ngayon?";

  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.hasSurrenderAvailabilityIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /Qualified Angeles City residents/i);
  assert.match(reply, /naka-pause/i);
  assert.match(reply, /huwag|sa halip/i);
});

test("answers surrender requirement questions", () => {
  const message = "What documents do I need to surrender my pet?";

  assert.equal(_test.hasSurrenderDocumentIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /owner and contact details/i);
  assert.match(reply, /vaccination or medical records/i);
  assert.match(reply, /honest reason/i);
});

test("answers Tagalog surrender requirement questions", () => {
  const message = "Ano ang kailangan para mag surrender ng pet?";

  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.hasSurrenderDocumentIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /owner at contact details/i);
  assert.match(reply, /vaccination o medical records/i);
  assert.match(reply, /tapat na reason/i);
});

test("answers surrender appointment questions", () => {
  const message = "When can I bring my pet for surrender?";

  assert.equal(_test.hasSurrenderAppointmentIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /^No\./);
  assert.match(reply, /Do not walk in or bring the animal/i);
  assert.match(reply, /approved the surrender request/i);
  assert.match(reply, /Submit the Surrender form first/i);
});

test("answers walk-in surrender questions directly", () => {
  const message = "pwede po pa walk in yung surrender?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.hasSurrenderAppointmentIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /^Hindi\./);
  assert.match(reply, /Huwag mag-walk in/i);
  assert.match(reply, /Surrender form/i);
  assert.doesNotMatch(reply, /^Para sa surrender request/i);
});

test("answers Tagalog surrender appointment questions", () => {
  const message = "Kailan ko dadalhin ang pet ko for surrender?";

  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.hasSurrenderAppointmentIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /^Hindi\./);
  assert.match(reply, /Huwag mag-walk in o dalhin/i);
  assert.match(reply, /approved/i);
  assert.match(reply, /Surrender form/i);
});

test("uses the selected English language even for Taglish questions", () => {
  const message = "kailan ma aapprove and application ko?";
  const language = _test.resolveReplyLanguage("english", message);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, language);

  assert.equal(language, "english");
  assert.match(reply, /There is no guaranteed approval time/i);
  assert.doesNotMatch(reply, /Walang guaranteed/i);
});

test("answers adoption timing from the user's pickup schedule when available", () => {
  const message = "kailan ma aapprove and application ko?";
  const reply = _test.getLocalReply(
    message,
    {
      pets: [],
      events: [],
      userAdoptions: [{
        applicationId: "APP-2026-001",
        petName: "Bingo",
        status: "Approved",
        pickupSchedule: { date: "2026-08-15", time: "14:30" },
        attendanceDeadlineAt: "2026-08-20T15:59:59.999Z"
      }]
    },
    "english"
  );

  assert.equal(_test.needsUserAdoptionContext(message), true);
  assert.match(reply, /Bingo/);
  assert.match(reply, /APP-2026-001/);
  assert.match(reply, /August 15, 2026 at 2:30 PM/);
  assert.doesNotMatch(reply, /no guaranteed approval time/i);
});

test("tells approved users to schedule pickup when no pickup schedule exists", () => {
  const message = "kailan ko pwede kunin ang inadopt ko?";
  const reply = _test.getLocalReply(
    message,
    {
      pets: [],
      events: [],
      userAdoptions: [{
        applicationId: "APP-2026-002",
        petName: "Ming",
        status: "Approved",
        pickupSchedule: null,
        attendanceDeadlineAt: "2026-08-20T15:59:59.999Z"
      }]
    },
    "tagalog"
  );

  assert.match(reply, /Approved na/i);
  assert.match(reply, /Ming/);
  assert.match(reply, /Schedule Pickup/);
  assert.match(reply, /August 20, 2026/);
});

test("answers Tagalog vet visit schedule questions naturally", () => {
  const message = "kailan pupunta ng vet?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), false);
  assert.equal(_test.hasVetVisitScheduleIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /kontakin muna/i);
  assert.match(reply, /office hours/i);
  assert.doesNotMatch(reply, /\*\*/);
  assert.doesNotMatch(reply, /May iba ka pa bang/i);
});
