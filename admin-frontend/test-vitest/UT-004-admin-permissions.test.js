import { describe, it, expect } from "vitest";
import { hasPermission } from "../src/auth/permissions.js";

describe("UT-004 — Admin Action Permission Matrix",()=>{
  it.each([[1,"Admin","users","delete",true],[2,"Staff","inventory","delete",false],[3,"Veterinarian","animals","add_medical",true],[4,"Veterinarian","adoption","approve",false],[5,"Public","dashboard","view",false]])("Scenario %i — checks %s %s.%s",(_n,role,moduleName,action,expected)=>expect(hasPermission(role,moduleName,action)).toBe(expected));
});
