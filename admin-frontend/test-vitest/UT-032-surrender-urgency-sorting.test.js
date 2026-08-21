import { describe, it, expect } from "vitest";
import { compareSurrenderUrgency } from "../src/management/surrenderRequestSorting.js";

const request=(id,urgencyLabel,submittedAt)=>({id,nlp:{urgencyLabel},submittedAt});
describe("UT-032 — Surrender Urgency Sorting",()=>{
  it("Scenario 1 — sorts Critical, High, Medium, then Low",()=>{const list=["Low","Critical","Medium","High"].map(x=>request(x,x,"2026-08-11"));expect(list.sort(compareSurrenderUrgency).map(x=>x.nlp.urgencyLabel)).toEqual(["Critical","High","Medium","Low"]);});
  it("Scenario 2 — puts the newer Critical request first",()=>{const list=[request("old","Critical","2026-08-10"),request("new","Critical","2026-08-11")];expect(list.sort(compareSurrenderUrgency).map(x=>x.id)).toEqual(["new","old"]);});
  it("Scenario 3 — ranks Low before unknown urgency",()=>{const list=[request("unknown","Unexpected","2026-08-11"),request("low","Low","2026-08-11")];expect(list.sort(compareSurrenderUrgency).map(x=>x.id)).toEqual(["low","unknown"]);});
  it("Scenario 4 — sorts equal urgency by newest valid timestamp",()=>{const list=[request("old","High","2026-08-10T00:00:00Z"),request("new","High","2026-08-11T00:00:00Z")];expect(list.sort(compareSurrenderUrgency).map(x=>x.id)).toEqual(["new","old"]);});
  it("Scenario 5 — places a valid current timestamp before the missing-date epoch fallback",()=>{const list=[request("missing","Medium",undefined),request("dated","Medium","2026-08-11")];expect(list.sort(compareSurrenderUrgency).map(x=>x.id)).toEqual(["dated","missing"]);});
});
