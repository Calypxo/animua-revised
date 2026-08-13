const scoring = require("../src/services/compatibilityScoringService");

const preferences = (value=3)=>Object.fromEntries(scoring.RAW_QUESTION_KEYS.map(key=>[key,value]));
const assessment = (value=3)=>Object.fromEntries(scoring.SCORING_DIMENSIONS.map(({key})=>[key,value]));
const animal = (id,value=3,extra={})=>({id,name:id,status:"Ready",species:"Dog",sex:"Male",behavioralAssessment:assessment(value),...extra});

describe("UT-024 — Compatibility Preference Validation and Profile Construction",()=>{
  it("Scenario 1 — accepts all 18 answers at one",()=>expect(scoring.validatePreferences(preferences(1)).preferences).toEqual(preferences(1)));
  it("Scenario 2 — accepts all 18 answers at five",()=>expect(scoring.validatePreferences(preferences(5)).preferences).toEqual(preferences(5)));
  it("Scenario 3 — identifies a missing climateTolerance",()=>{const p=preferences();delete p.climateTolerance;expect(scoring.validatePreferences(p).error).toMatch(/climateTolerance/);});
  it.each([[2.5],[0],[6]])("Scenario 4 — rejects invalid answer %s",(value)=>{const p=preferences();p.energyLevel=value;expect(scoring.validatePreferences(p).error).toMatch(/energyLevel/);});
  it("Scenario 5 — aggregates Attention/Grooming and maps Health Risk",()=>{const p=preferences();p.attentionNeeds=1;p.groomingNeeds=5;p.healthRiskLevel=4;const profile=scoring.buildUserProfile(p);expect(profile.attentionNeeds).toBe(3);expect(profile.specialNeeds).toBe(4);expect(profile).not.toHaveProperty("climateTolerance");expect(scoring.buildVector({})[0]).toBe(3);});
});

describe("UT-025 — Compatibility Scoring, Filtering, and Fallback",()=>{
  it("Scenario 1 — gives identical vectors score 1 and 100 percent",()=>expect(scoring.scoreVectors(Array(16).fill(4),Array(16).fill(4))).toEqual({matchScore:1,matchPercent:100}));
  it("Scenario 2 — ranks exact, close, then far",()=>expect(scoring.scoreMatchesLocally(preferences(4),[animal("far",1),animal("close",3),animal("exact",4)],3).matches.map(x=>x.id)).toEqual(["exact","close","far"]));
  it("Scenario 3 — excludes non-Ready and mismatched species or sex",()=>{const filters={preferredSpecies:"Dog",preferredSex:"Male",needAllergyFriendly:"no",acceptSpecialNeeds:"yes"};expect(scoring.applyFilters([animal("ready"),animal("not-ready",3,{status:"Quarantine"}),animal("cat",3,{species:"Cat"}),animal("female",3,{sex:"Female"})],filters).map(x=>x.id)).toEqual(["ready"]);});
  it("Scenario 4 — always excludes aggression 5 and conditionally excludes special needs 4",()=>{const filters={preferredSpecies:"Any",preferredSex:"Any",needAllergyFriendly:"no",acceptSpecialNeeds:"no"};expect(scoring.applyFilters([animal("safe",3),animal("aggressive",3,{behavioralAssessment:{...assessment(3),aggressive:5}}),animal("special",3,{behavioralAssessment:{...assessment(3),specialNeeds:4}})],filters).map(x=>x.id)).toEqual(["safe"]);});
  it("Scenario 5 — uses the mathematically equivalent local result after Python transport failure",async()=>{const pets=[animal("far",5),animal("exact",2),animal("close",3)];const expected=scoring.scoreMatchesLocally(preferences(2),pets,3);await expect(scoring.scoreMatches(preferences(2),pets,3,{fetchImpl:vi.fn().mockRejectedValue(new Error("offline")),logger:{warn:vi.fn()}})).resolves.toEqual(expected);});
});
