const { loadWithMocks, responseRecorder, snapshot } = require("./helpers/commonjs");

const verify=vi.fn(); const get=vi.fn();
const authenticateToken=loadWithMocks("../src/middleware/authMiddleware",{
  "../src/config/firebase":{db:{collection:()=>({doc:()=>({get})})}},
  "jsonwebtoken":{verify},
});
const authorizeRole=require("../src/middleware/roleMiddleware");

describe("UT-008 — Token Authentication Middleware",()=>{
  beforeEach(()=>{verify.mockReset();get.mockReset();process.env.JWT_SECRET="test-secret";});
  it("Scenario 1 — returns HTTP 401 and does not continue without a token",async()=>{const res=responseRecorder(),next=vi.fn();await authenticateToken({headers:{}},res,next);expect(res.statusCode).toBe(401);expect(next).not.toHaveBeenCalled();});
  it.each([[2,"TokenExpiredError"],[2,"JsonWebTokenError"]])("Scenario %i — returns HTTP 401 for invalid JWT (%s)",async(_n,name)=>{verify.mockImplementation(()=>{const e=new Error("bad token");e.name=name;throw e;});const res=responseRecorder(),next=vi.fn();await authenticateToken({headers:{authorization:"Bearer bad"}},res,next);expect(res.statusCode).toBe(401);expect(next).not.toHaveBeenCalled();});
  it("Scenario 3 — returns HTTP 401 when the account no longer exists",async()=>{verify.mockReturnValue({email:"User@Test.com"});get.mockResolvedValue(snapshot(undefined,"user@test.com"));const res=responseRecorder();await authenticateToken({headers:{authorization:"Bearer valid"}},res,vi.fn());expect(res.statusCode).toBe(401);});
  it("Scenario 4 — returns HTTP 403 for an inactive account",async()=>{verify.mockReturnValue({email:"user@test.com"});get.mockResolvedValue(snapshot({role:"Staff",status:"Inactive"},"user@test.com"));const res=responseRecorder();await authenticateToken({headers:{authorization:"Bearer valid"}},res,vi.fn());expect(res.statusCode).toBe(403);});
  it("Scenario 5 — populates the exact active Staff user contract and calls next once",async()=>{verify.mockReturnValue({email:" Staff@Test.com "});get.mockResolvedValue(snapshot({firstName:"Ana",lastName:"Reyes",role:"staff",status:"Active"},"staff@test.com"));const req={headers:{authorization:"Bearer valid"}},res=responseRecorder(),next=vi.fn();await authenticateToken(req,res,next);expect(req.user).toEqual({id:"staff@test.com",email:"staff@test.com",firstName:"Ana",lastName:"Reyes",fullName:"Ana Reyes",role:"Staff",status:"Active"});expect(next).toHaveBeenCalledOnce();});
});

describe("UT-009 — Backend Role Authorization Middleware",()=>{
  it("Scenario 1 — permits exact Staff when Admin and Staff are allowed",()=>{const next=vi.fn();authorizeRole("Admin","Staff")({user:{role:"Staff"}},responseRecorder(),next);expect(next).toHaveBeenCalledOnce();});
  it("Scenario 2 — rejects Public with HTTP 403",()=>{const res=responseRecorder();authorizeRole("Admin","Staff")({user:{role:"Public"}},res,vi.fn());expect(res.statusCode).toBe(403);});
  it("Scenario 3 — rejects a missing user with HTTP 403",()=>{const res=responseRecorder();authorizeRole("Admin","Staff")({},res,vi.fn());expect(res.statusCode).toBe(403);});
  it("Scenario 4 — performs no lowercase role normalization",()=>{const res=responseRecorder();authorizeRole("Staff")({user:{role:"staff"}},res,vi.fn());expect(res.statusCode).toBe(403);});
  it("Scenario 5 — permits exact Admin",()=>{const next=vi.fn();authorizeRole("Admin")({user:{role:"Admin"}},responseRecorder(),next);expect(next).toHaveBeenCalledOnce();});
});
