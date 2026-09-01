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

  assert.match(reply, /^Para sa dog food/);
  assert.match(reply, /message ang staff sa Contact Us/i);
  assert.match(reply, /dog food, cat food/i);
  assert.doesNotMatch(reply, /Find Furbabies/i);
  assert.doesNotMatch(reply, /marked Ready/i);
});

test("directs a found stray animal to Contact Us without feature history", () => {
  const reply = _test.getLocalReply(
    "I found a stray cat here",
    { pets: [], events: [] },
    "english"
  );

  assert.match(reply, /message the staff through Contact Us/i);
  assert.doesNotMatch(reply, /no longer|reporting feature|reporting page|Dog Pound/i);
  assert.ok(reply.length < 100);
});

test("answers how to donate without a leading yes", () => {
  const reply = _test.getLocalReply(
    "how can I donate?",
    { pets: [], events: [] },
    "english"
  );

  assert.match(reply, /^For dog food, cat food, or other donations/i);
  assert.match(reply, /Contact Us/i);
  assert.doesNotMatch(reply, /^Yes\b/i);
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

test("directs personal pet vaccination requests to shelter staff through Contact Us", () => {
  const message = "I want to vaccine my dog in the vet";

  assert.equal(_test.hasPersonalPetVaccinationRequestIntent(message), true);
  assert.equal(_test.hasAnimalAvailabilityIntent(message), false);
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), false);

  const reply = _test.getLocalReply(message, { pets: samplePets, events: [] }, "english");

  assert.match(reply, /^Please contact the shelter staff through Contact Us/i);
  assert.match(reply, /pet vaccination is available/i);
  assert.match(reply, /schedule and requirements/i);
  assert.doesNotMatch(reply, /Find Furbabies animals|Tricolor|Dark brown/i);
});

test("directs Tagalog personal pet vaccination requests through Contact Us", () => {
  const message = "Gusto ko pabakunahan ang aso ko sa vet";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.hasPersonalPetVaccinationRequestIntent(message), true);
  assert.equal(_test.hasAnimalAvailabilityIntent(message), false);
  assert.equal(_test.needsPublicContext(message), false);

  const reply = _test.getLocalReply(message, { pets: samplePets, events: [] }, "tagalog");

  assert.match(reply, /^Paki-contact ang shelter staff through Contact Us/i);
  assert.match(reply, /pet vaccination/i);
  assert.match(reply, /schedule at requirements/i);
  assert.doesNotMatch(reply, /Find Furbabies|Tricolor|Dark brown/i);
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

test("keeps published vaccination events from the Home page announcement source", () => {
  const announcement = _test.normalizeAnnouncementEvent("vaccination-event", {
    type: "Upcoming Events",
    title: "Veterinary Services Brought Closer to Angelenos",
    eventDate: "2026-09-15",
    eventTime: "9:00 AM - 3:00 PM",
    location: "Pulung Maragul Covered Court",
    caption: "Free vaccination for local pets.",
    status: "Published",
    visibleToPublic: true
  });

  assert.ok(announcement);
  assert.equal(_test.isPublishedPublicEvent(announcement), true);

  const reply = _test.getLocalReply(
    "when is the next vaccination and where?",
    { pets: [], events: [announcement] },
    "english"
  );

  assert.match(reply, /Veterinary Services Brought Closer to Angelenos/i);
  assert.match(reply, /September 15, 2026/i);
  assert.match(reply, /9:00 AM - 3:00 PM/i);
  assert.match(reply, /Pulung Maragul Covered Court/i);
  assert.doesNotMatch(reply, /I do not see a published vaccination/i);
});

test("does not expose hidden event announcements to the chatbot", () => {
  const hiddenAnnouncement = _test.normalizeAnnouncementEvent("hidden-event", {
    type: "Upcoming Events",
    title: "Private Vaccination Event",
    eventDate: "2026-09-20",
    status: "Published",
    visibleToPublic: false
  });

  assert.equal(_test.isPublishedPublicEvent(hiddenAnnouncement), false);
});

test("answers from the same vaccination fallback displayed on the Home page", () => {
  const fallbackEvent = _test.getHomeFallbackUpcomingEvent();
  const reply = _test.getLocalReply(
    "when is the next vaccination and where?",
    { pets: [], events: [fallbackEvent] },
    "english"
  );

  assert.match(reply, /Veterinary Services Brought Closer to Angelenos/i);
  assert.match(reply, /9:00 AM - 3:00 PM/i);
  assert.match(reply, /Savannah Phase 1, Savannah Phase 2, and Green Plain Phase 3/i);
  assert.doesNotMatch(reply, /I do not see a published vaccination/i);
});

test("answers the generated upcoming-events question even when live context fails", () => {
  const fallbackContext = _test.getEmptyPublicContext();
  const reply = _test.getLocalReply(
    "What upcoming events are available?",
    fallbackContext,
    "english"
  );

  assert.match(reply, /Veterinary Services Brought Closer to Angelenos/i);
  assert.match(reply, /9:00 AM - 3:00 PM/i);
  assert.match(reply, /Savannah Phase 1, Savannah Phase 2, and Green Plain Phase 3/i);
  assert.doesNotMatch(reply, /There are no published upcoming events/i);
});

test("answers the next-event question with only the earliest published event", () => {
  const events = [
    {
      title: "Second Community Event",
      date: "2026-09-20",
      location: "Barangay Tabun Covered Court"
    },
    {
      title: "First Community Event",
      date: "2026-09-10",
      location: "Angeles City Hall"
    }
  ];
  const message = "when will the next event?";

  assert.equal(_test.hasNextEventIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events }, "english");

  assert.match(reply, /next published event/i);
  assert.match(reply, /First Community Event/i);
  assert.doesNotMatch(reply, /Second Community Event/i);
});

test("answers the next-event question in Tagalog", () => {
  const message = "Kailan ang susunod na event?";
  const events = [{
    title: "Barangay Pet Wellness Day",
    date: "2026-09-10",
    location: "Angeles City Hall"
  }];

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.hasNextEventIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events }, "tagalog");

  assert.match(reply, /^Ang susunod na published event/i);
  assert.match(reply, /Barangay Pet Wellness Day/i);
});

test("says no announcement yet when a requested barangay has no matching event", () => {
  const events = [
    ...sampleEvents,
    {
      title: "Barangay Vaccination Day",
      date: "2026-09-15",
      location: "Brgy. Tabun Covered Court"
    }
  ];
  const message = "when will be the cutcut?";

  assert.equal(_test.getMentionedBarangay(message)?.name, "Cutcut");
  assert.equal(_test.hasBarangayEventIntent(message), true);
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events }, "english");

  assert.match(reply, /no published event announcement for Barangay Cutcut yet/i);
  assert.doesNotMatch(reply, /Free Anti-Rabies Vaccination Drive|Barangay Vaccination Day/i);
  assert.doesNotMatch(reply, /mainly here for ANIMUA/i);
});

test("says no barangay announcement yet in Tagalog", () => {
  const message = "Kailan naman sa Cutcut?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.hasBarangayEventIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: sampleEvents }, "tagalog");

  assert.match(reply, /^Wala pang published event announcement para sa Barangay Cutcut/i);
  assert.doesNotMatch(reply, /Free Anti-Rabies Vaccination Drive/i);
});

test("returns only announcements matching the requested barangay", () => {
  const events = [
    ...sampleEvents,
    {
      title: "Barangay Vaccination Day",
      date: "2026-09-15",
      location: "Brgy. Tabun Covered Court"
    }
  ];
  const reply = _test.getLocalReply(
    "when will be in barangay Tabun?",
    { pets: [], events },
    "english"
  );

  assert.match(reply, /published event for Barangay Tabun/i);
  assert.match(reply, /Barangay Vaccination Day/i);
  assert.doesNotMatch(reply, /Free Anti-Rabies Vaccination Drive/i);
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

test("answers Taglish adopted-dog pickup questions with the approval and scheduling workflow", () => {
  const messages = [
    "paano ko pipick up yung aso ko?",
    "pano ko pipick up yung aso kong inadopt?",
    "kailan ko pwede kunin ang inadopt ko?"
  ];

  for (const message of messages) {
    assert.equal(_test.shouldUseLocalReply(message), true, message);
    assert.equal(_test.needsPublicContext(message), false, message);
    assert.equal(_test.hasAdoptionPickupIntent(message), true, message);

    const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

    assert.match(reply, /My Applications/i, message);
    assert.match(reply, /Approved ang adoption application/i, message);
    assert.match(reply, /Schedule Pickup/i, message);
    assert.match(reply, /pickup date at time/i, message);
    assert.doesNotMatch(reply, /pang-ANIMUA/i, message);
  }
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
  assert.match(prompt, /stray, found, or abandoned animal.*Contact Us/i);
  assert.match(prompt, /answer in English even if the user writes Taglish/i);
  assert.match(prompt, /simple, everyday words and short sentences/i);
  assert.match(prompt, /Prefer one or two short sentences/i);
  assert.match(prompt, /do not repeat dates, page names, requirements, warnings, or next steps/i);
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

  assert.match(reply, /^Maaari kang/);
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

  assert.match(reply, /^Maaari kang/);
  assert.match(reply, /higit sa isang pet/i);
  assert.match(reply, /ire-review ng shelter/i);
  assert.doesNotMatch(reply, /pumunta sa Find Furbabies/i);
});

test("answers three adoption application questions directly", () => {
  const message = "Pwede ba akong mag-submit ng tatlong application?";

  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /^Maaari kang/);
  assert.match(reply, /higit sa isang pet/i);
  assert.doesNotMatch(reply, /buksan ang Find Furbabies/i);
});

test("tells a user who wants five dogs to apply separately and wait for approval", () => {
  const message = "I want to adopt 5 dogs";

  assert.equal(_test.hasAdoptionQuantityIntent(message), true);
  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.needsPublicContext(message), false);

  const reply = _test.getLocalReply(message, { pets: samplePets, events: [] }, "english");

  assert.match(reply, /separate adoption application for each dog/i);
  assert.match(reply, /wait for the Angeles City Veterinary Office to review and approve each application/i);
  assert.doesNotMatch(reply, /Here are Find Furbabies animals/i);
  assert.doesNotMatch(reply, /Tricolor|Dark brown|Tantan/i);
});

test("answers adoption quantity questions without a leading yes", () => {
  const reply = _test.getLocalReply(
    "how many can I adopt?",
    { pets: [], events: [] },
    "english"
  );

  assert.match(reply, /^You may apply for more than one pet/i);
  assert.doesNotMatch(reply, /^Yes\b/i);
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

test("explains the complete Match Quiz process and configured retake rule in English", () => {
  const message = "How does the Match Quiz work?";
  const reply = _test.getLocalReply(
    message,
    {
      pets: [],
      events: [],
      quiz: {
        ..._test.getEmptyQuizContext(),
        loaded: true,
        retakeCooldownDays: 31
      }
    },
    "english"
  );

  assert.equal(_test.hasQuizProcessIntent(message), true);
  assert.match(reply, /Sign in, open Match Quiz/i);
  assert.match(reply, /set your preferences/i);
  assert.match(reply, /all five sections/i);
  assert.match(reply, /31-day wait/i);
  assert.match(reply, /Next allowed retake/i);
});

test("answers a logged-in user's exact quiz retake date in English", () => {
  const message = "When can I retake the quiz?";
  const reply = _test.getLocalReply(
    message,
    {
      pets: [],
      events: [],
      quiz: {
        loaded: true,
        authenticated: true,
        quizEnabled: true,
        retakeCooldownDays: 30,
        hasPreviousResult: true,
        canTakeQuiz: false,
        reason: "RETAKE_COOLDOWN",
        nextRetakeAt: "2026-09-30T00:00:00.000Z",
        remainingDays: 12
      }
    },
    "english"
  );

  assert.equal(_test.hasQuizRetakeIntent(message), true);
  assert.match(reply, /September 30, 2026/i);
  assert.match(reply, /12 days/i);
  assert.doesNotMatch(reply, /My Submissions|all five sections/i);
  assert.ok(reply.length < 180);
});

test("answers quiz retake availability in Tagalog", () => {
  const message = "Kailan ako puwedeng mag-quiz ulit?";
  const reply = _test.getLocalReply(
    message,
    {
      pets: [],
      events: [],
      quiz: {
        loaded: true,
        authenticated: true,
        quizEnabled: true,
        retakeCooldownDays: 30,
        hasPreviousResult: true,
        canTakeQuiz: true,
        reason: "RETAKE_AVAILABLE",
        nextRetakeAt: "2026-08-20T00:00:00.000Z",
        remainingDays: 0
      }
    },
    "tagalog"
  );

  assert.equal(_test.hasQuizRetakeIntent(message), true);
  assert.match(reply, /Maaari mo nang ulitin ang Match Quiz ngayon/i);
  assert.match(reply, /account history/i);
  assert.doesNotMatch(reply, /current matches|all five sections/i);
  assert.ok(reply.length < 180);
});

test("answers a logged-in user's exact quiz retake date in Tagalog", () => {
  const message = "Kailan ko maaaring ulitin ang Match Quiz?";
  const reply = _test.getLocalReply(
    message,
    {
      pets: [],
      events: [],
      quiz: {
        loaded: true,
        authenticated: true,
        quizEnabled: true,
        retakeCooldownDays: 30,
        hasPreviousResult: true,
        canTakeQuiz: false,
        reason: "RETAKE_COOLDOWN",
        nextRetakeAt: "2026-09-30T00:00:00.000Z",
        remainingDays: 12
      }
    },
    "tagalog"
  );

  assert.equal(_test.hasQuizRetakeIntent(message), true);
  assert.match(reply, /Setyembre 30, 2026/i);
  assert.match(reply, /12 araw/i);
  assert.doesNotMatch(reply, /lahat ng limang sections|My Submissions/i);
  assert.ok(reply.length < 190);
});

test("routes application status questions to My Applications instead of animal visits", () => {
  [
    "Where can I see my adoption application status?",
    "what happen to my application",
  ].forEach((message) => {
    assert.equal(_test.resolveReplyLanguage("english", message), "english");
    assert.equal(_test.shouldUseLocalReply(message), true);
    assert.equal(_test.hasVisitAnimalIntent(message), false);

    const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

    assert.match(reply, /sign in to your ANIMUA account/i);
    assert.match(reply, /official updates/i);
    assert.doesNotMatch(reply, /visiting or meeting an animal/i);
    assert.doesNotMatch(reply, /open Find Furbabies, choose an animal/i);
  });
});

test("routes Tagalog application status questions to My Applications", () => {
  const message = "Ano na ang application ko?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.shouldUseLocalReply(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /status ng adoption application/i);
  assert.match(reply, /My Applications/i);
  assert.match(reply, /official updates/i);
  assert.doesNotMatch(reply, /buksan ang Find Furbabies, pumili ng animal/i);
});

test("answers adoption cancellation after applying with the 14-day attendance rule", () => {
  [
    "what if I cancel the adoption after I apply?",
    "I want to cancel my adoption",
  ].forEach((message) => {
    assert.equal(_test.shouldUseLocalReply(message), true);

    const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

    assert.match(reply, /does not have a cancel or withdraw option/i);
    assert.match(reply, /14-day attendance rule/i);
    assert.match(reply, /account suspension/i);
    assert.match(reply, /only when you are fully ready to adopt/i);
    assert.doesNotMatch(reply, /After an adoption is approved, follow the official instructions/i);
    assert.doesNotMatch(reply, /To adopt, go to Find Furbabies/i);
    assert.doesNotMatch(reply, /open My Applications/i);
  });
});

test("answers adoption cancellation in Tagalog", () => {
  const message = "Gusto ko i-cancel ang adoption ko";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /^Walang cancel o withdraw option/i);
  assert.match(reply, /14-day attendance rule/i);
  assert.match(reply, /account suspension/i);
  assert.doesNotMatch(reply, /Para mag-adopt, pumunta sa Find Furbabies/i);
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

test("keeps the Porac surrender eligibility answer concise", () => {
  const message = "can I surrender pet? im from Porac";
  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /^No\./);
  assert.match(reply, /only for qualified Angeles City residents/i);
  assert.match(reply, /local city or municipal veterinary office/i);
  assert.ok(reply.length < 190);
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

test("answers the exact Angeles City Veterinary Office location instead of generic navigation", () => {
  const englishMessage = "where is the angeles city vet?";
  const tagalogMessage = "Saan ang Angeles City Veterinary Office?";

  assert.equal(_test.hasOfficeLocationIntent(englishMessage), true);
  assert.equal(_test.shouldUseLocalReply(englishMessage), true);

  const englishReply = _test.getLocalReply(englishMessage, { pets: [], events: [] }, "english");
  const tagalogReply = _test.getLocalReply(tagalogMessage, { pets: [], events: [] }, "tagalog");

  assert.match(englishReply, /City Hall Building, Pulung Maragul, Angeles City, Pampanga 2009/i);
  assert.match(englishReply, /inside the Angeles City Hall compound/i);
  assert.doesNotMatch(englishReply, /public navigation links/i);
  assert.match(tagalogReply, /City Hall Building, Pulung Maragul, Angeles City, Pampanga 2009/i);
  assert.doesNotMatch(tagalogReply, /public navigation links/i);
});

test("provides Tagalog equivalents for the corrected chatbot replies", () => {
  const fallbackContext = _test.getEmptyPublicContext();
  const cases = [
    {
      message: "May upcoming events ba?",
      expected: [/Veterinary Services Brought Closer to Angelenos/i, /Savannah Phase 1/i],
      excluded: /walang published upcoming events/i
    },
    {
      message: "Maaari ba akong mag-surrender? Taga-Porac ako.",
      expected: [/qualified Angeles City residents/i, /local city o municipal veterinary office/i]
    },
    {
      message: "Paano ako mag-donate?",
      expected: [/^Para sa dog food/i, /Contact Us/i],
      excluded: /^Oo\b/i
    },
    {
      message: "May nakita akong stray na pusa",
      expected: [/Paki-message ang staff sa Contact Us/i],
      excluded: /reporting feature|reporting page|Dog Pound/i
    },
    {
      message: "Paano kung i-cancel ko ang adoption application pagkatapos kong mag-apply?",
      expected: [/Walang cancel o withdraw option/i, /14-day attendance rule/i, /account suspension/i, /handa ka nang mag-adopt/i],
      excluded: /official instructions shown in ANIMUA/i
    },
    {
      message: "Ilang pet ang maaari kong i-adopt?",
      expected: [/^Maaari kang mag-apply/i, /profile ng bawat pet/i, /hintayin ang approval/i],
      excluded: /profile ng bawat dog/i
    }
  ];

  for (const item of cases) {
    const reply = _test.getLocalReply(item.message, fallbackContext, "tagalog");
    for (const pattern of item.expected) assert.match(reply, pattern, item.message);
    if (item.excluded) assert.doesNotMatch(reply, item.excluded, item.message);
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
  assert.match(reply, /change an approved adoption pickup twice/i);
  assert.match(reply, /14-day deadline/i);
  assert.match(reply, /second change is final/i);
});

test("answers Tagalog adoption pickup reschedule questions", () => {
  const message = "Pwede bang ilipat ang pickup schedule ko?";

  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.hasAdoptionPickupRescheduleIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /Reschedule/i);
  assert.match(reply, /dalawang beses/i);
  assert.match(reply, /14-day deadline/i);
  assert.match(reply, /Final ang pangalawang pagbabago/i);
});

test("answers how many adoption pickup reschedules remain from account context", () => {
  const message = "How many pickup reschedules do I have left?";
  const reply = _test.getLocalReply(
    message,
    {
      pets: [],
      events: [],
      userAdoptions: [{
        applicationId: "APP-2026-RESCHEDULE",
        petName: "Bingo",
        status: "Approved",
        pickupSchedule: {
          date: "2026-09-02",
          time: "10:00",
          rescheduleCount: 1
        }
      }]
    },
    "english"
  );

  assert.match(reply, /one final pickup reschedule/i);
  assert.match(reply, /Bingo/i);
  assert.match(reply, /APP-2026-RESCHEDULE/i);
  assert.match(reply, /next change will be final/i);
});

test("explains when an adoption pickup has reached its reschedule limit", () => {
  const message = "Pwede ko pa bang ilipat ang pickup schedule ko?";
  const reply = _test.getLocalReply(
    message,
    {
      pets: [],
      events: [],
      userAdoptions: [{
        applicationId: "APP-2026-FINAL",
        petName: "Ming",
        status: "Approved",
        pickupSchedule: {
          date: "2026-09-03",
          time: "13:00",
          rescheduleCount: 2
        }
      }]
    },
    "tagalog"
  );

  assert.match(reply, /Nagamit mo na ang parehong pickup reschedules/i);
  assert.match(reply, /Final na ang current pickup schedule/i);
  assert.match(reply, /disabled na ang Reschedule option/i);
});

test("explains surrender appointment rescheduling in simple English", () => {
  const message = "Can I reschedule my surrender drop-off appointment?";

  assert.equal(_test.shouldUseLocalReply(message), true);
  assert.equal(_test.hasSurrenderAppointmentRescheduleIntent(message), true);
  assert.equal(_test.hasAdoptionPickupRescheduleIntent(message), false);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /My Submissions/i);
  assert.match(reply, /appointment once/i);
  assert.match(reply, /14-day deadline/i);
  assert.match(reply, /Follow the old schedule/i);
});

test("explains surrender appointment rescheduling in Tagalog", () => {
  const message = "Pwede ko bang ilipat ang surrender appointment ko?";

  assert.equal(_test.resolveReplyLanguage("tagalog", message), "tagalog");
  assert.equal(_test.hasSurrenderAppointmentRescheduleIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /My Submissions/i);
  assert.match(reply, /Isang beses/i);
  assert.match(reply, /14-day deadline/i);
  assert.match(reply, /Sundin muna ang dating schedule/i);
});

test("distinguishes both rescheduling workflows when the request is ambiguous", () => {
  const message = "Can I reschedule?";

  assert.equal(_test.hasGeneralRescheduleIntent(message), true);
  assert.equal(_test.shouldUseLocalReply(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /adoption pickup/i);
  assert.match(reply, /change an adoption pickup twice/i);
  assert.match(reply, /surrender appointment/i);
  assert.match(reply, /appointment once/i);
});

test("answers a blocked reschedule question with a short explanation", () => {
  const message = "bakit hindi na ako makapag resched?";

  assert.equal(_test.hasBlockedRescheduleQuestion(message), true);

  const englishReply = _test.getLocalReply(message, { pets: [], events: [] }, "english");
  const tagalogReply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(englishReply, /reached the reschedule limit/i);
  assert.match(englishReply, /up to 2 changes/i);
  assert.match(englishReply, /1 change/i);
  assert.ok(englishReply.length < 260);
  assert.match(tagalogReply, /Baka naabot mo na/i);
  assert.match(tagalogReply, /hanggang 2 changes/i);
  assert.match(tagalogReply, /1 change lang/i);
  assert.ok(tagalogReply.length < 280);
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

test("reassures owners that accepted surrendered pets will receive the shelter's best care", () => {
  const message = "if I surrender my pet will you take care of my dogs?";

  assert.equal(_test.hasSurrenderCareIntent(message), true);
  assert.equal(_test.shouldUseLocalReply(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "english");

  assert.match(reply, /^Yes\./);
  assert.match(reply, /shelter team will do their best/i);
  assert.match(reply, /care for your pet and keep them safe/i);
  assert.match(reply, /approved and your pet is accepted/i);
  assert.doesNotMatch(reply, /^For surrender requests, open the Surrender page/i);
});

test("reassures owners about surrendered-pet care in Tagalog", () => {
  const message = "Kapag sinurrender ko ang aso ko, aalagaan ba ninyo?";

  assert.equal(_test.resolveReplyLanguage("", message), "tagalog");
  assert.equal(_test.hasSurrenderCareIntent(message), true);

  const reply = _test.getLocalReply(message, { pets: [], events: [] }, "tagalog");

  assert.match(reply, /^Oo\./);
  assert.match(reply, /gagawin ng shelter team ang kanilang makakaya/i);
  assert.match(reply, /maalagaan at mapanatiling ligtas/i);
  assert.match(reply, /approved ang surrender request/i);
  assert.doesNotMatch(reply, /^Para sa surrender request, buksan ang Surrender page/i);
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
