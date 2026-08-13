import { describe, it, expect } from "vitest";
import { buildQuarantineDecisionPayload } from "../src/management/animalProfileWorkflow.js";

describe("UT-022 — Behavioral Assessment and Quarantine Readiness",()=>{
  it("Scenario 5 — creates the approved Quarantine Clearance payload",()=>expect(buildQuarantineDecisionPayload(null,"Cleared","2026-08-10")).toEqual({type:"Quarantine Clearance",date:"2026-08-10",diagnosis:"Quarantine readiness reviewed.",treatment:"",notes:"Decision recorded from the care readiness panel.",clearance:"Cleared",weight:null,inventoryItemId:"",quantityUsed:0}));
});
