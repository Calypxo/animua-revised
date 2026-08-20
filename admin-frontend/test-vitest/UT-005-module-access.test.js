import { describe, it, expect } from "vitest";
import { canAccessModule } from "../src/auth/permissions.js";

describe("UT-005 — Admin Module Access Matrix",()=>{
  it.each([[1,"Admin","users",true],[2,"Staff","adoption",true],[3,"Staff","audit",false],[4,"Veterinarian","quarantine",true],[5,"Public","dashboard",false]])("Scenario %i — checks %s access to %s",(_n,role,moduleName,expected)=>expect(canAccessModule(role,moduleName)).toBe(expected));
});
