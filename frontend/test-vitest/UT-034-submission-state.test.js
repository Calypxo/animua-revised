import { describe, it, expect } from "vitest";
import { mergeSubmissionResults, submissionLoadErrorMessage } from "../src/public/js/mySubmissionsState.js";

describe("UT-034 — Frontend Submission State Utilities",()=>{
  it("Scenario 1 — keeps two empty service results empty",()=>expect(mergeSubmissionResults([],[])).toEqual([]));
  it("Scenario 2 — returns adoption records before surrender records",()=>{const A={id:"A"},S={id:"S"};expect(mergeSubmissionResults([A],[S])).toEqual([A,S]);});
  it("Scenario 3 — includes useful error detail",()=>expect(submissionLoadErrorMessage(new Error("Network unavailable"))).toContain("Network unavailable"));
  it("Scenario 4 — returns the exact generic retry message without useful detail",()=>expect(submissionLoadErrorMessage({})).toBe("Unable to load your submissions. Please try again."));
  it("Scenario 5 — returns only real adoption records without demo fallback",()=>{const A={id:"A"};expect(mergeSubmissionResults([A],[])).toEqual([A]);});
});
