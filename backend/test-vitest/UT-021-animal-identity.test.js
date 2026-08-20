const { buildShelterLabel, getAnimalDisplayLabel, isMeaningfulLegacyName } = require("../src/utils/animalIdentity");

describe("UT-021 — Animal Identity Labels", () => {
  it("Scenario 1 — uses identifyingDescription first",()=>expect(buildShelterLabel({identifyingDescription:"Brown dog with white paws"})).toBe("Brown dog with white paws"));
  it("Scenario 2 — builds the structured ageEstimate identity",()=>expect(buildShelterLabel({color:"Brown",ageEstimate:"Adult",sex:"Male",species:"Dog"})).toBe("Brown - Adult Male Dog"));
  it("Scenario 3 — ignores Unknown and falls back to the animal ID",()=>{expect(isMeaningfulLegacyName("Unknown")).toBeFalsy();expect(buildShelterLabel({animalName:"Unknown"},"ANIM-001")).toBe("Animal ANIM-001");});
  it("Scenario 4 — displays the adopted name for exact Adopted status",()=>expect(getAnimalDisplayLabel({status:"Adopted",adoptedName:"Bingo"},"ANIM-001")).toBe("Bingo"));
  it("Scenario 5 — ignores adoptedName while status is Ready",()=>expect(getAnimalDisplayLabel({status:"Ready",adoptedName:"Bingo",identifyingDescription:"Brown dog"},"ANIM-001")).toBe("Brown dog"));
});
