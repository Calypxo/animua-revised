const { getCurrentAnimalProfiles } = require("../src/services/dashboardMetricsService");

describe("UT-031 — Dashboard Current Animal Population",()=>{
  it("Scenario 1 — retains Profiling, Quarantine, Ready and excludes Adopted, Archived",()=>{const statuses=["Profiling","Quarantine","Ready","Adopted","Archived"];expect(getCurrentAnimalProfiles(statuses.map(status=>({status}))).map(x=>x.status)).toEqual(["Profiling","Quarantine","Ready"]);});
  it("Scenario 2 — returns an empty array for empty input",()=>expect(getCurrentAnimalProfiles([])).toEqual([]));
  it("Scenario 3 — retains an animal without status",()=>expect(getCurrentAnimalProfiles([{id:"A"}])).toEqual([{id:"A"}]));
  it("Scenario 4 — excludes exact Adopted",()=>expect(getCurrentAnimalProfiles([{status:"Adopted"}])).toEqual([]));
  it("Scenario 5 — excludes exact Archived",()=>expect(getCurrentAnimalProfiles([{status:"Archived"}])).toEqual([]));
});
