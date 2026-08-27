const { loadWithMocks, responseRecorder, snapshot } = require("./helpers/commonjs");

const settingsGet=vi.fn(); const requestSet=vi.fn(); const requestUpdate=vi.fn();
const db={collection:vi.fn((name)=>({doc:()=>name==="surrenderSettings"?{get:settingsGet}:{set:requestSet,update:requestUpdate}}))};
const analyzeSurrenderReason=vi.fn();
const buildFallbackAnalysis=vi.fn(()=>({sentiment:"Neutral",category:"Relocation",urgencyLabel:"Low",urgencyScore:25,confidence:0,keywords:["moving"],suggestedPriority:"Normal Priority",source:"Node fallback (Tagalog sentiment service unavailable)"}));
const createSurrenderRequest=loadWithMocks("../src/controllers/surrenderController",{
  "../src/config/firebase":{db,admin:{}},
  "../src/services/surrenderNlpService":{analyzeSurrenderReason,buildFallbackAnalysis},
  "../src/services/notificationService":{createUserNotification:vi.fn(),createManagementNotification:vi.fn().mockResolvedValue()},
}).createSurrenderRequest;

const image={name:"id.png",type:"image/png",size:4,dataUrl:"data:image/png;base64,AAAA"};
const validBody=(extra={})=>({owner:{contact:"0917",address:"Pampang",barangay:"Pampang",city:"Angeles City",identityDocuments:{front:image,back:image}},pet:{species:"Dog"},agreement:{agreedToTerms:true},surrenderReason:"Moving to another home",...extra});
const req=(body)=>({body,user:{email:"user@test.com",fullName:"Ana User",role:"Public"}});

describe("UT-012 — Surrender Request Validation",()=>{
  beforeEach(()=>{settingsGet.mockReset().mockResolvedValue(snapshot({acceptingRequests:true}));requestSet.mockReset().mockResolvedValue();requestUpdate.mockReset().mockResolvedValue();analyzeSurrenderReason.mockReset().mockResolvedValue({sentiment:"Neutral",category:"Relocation",urgencyLabel:"Low",urgencyScore:25,source:"mock"});});
  it("Scenario 1 — returns HTTP 503 and the closed-request code",async()=>{settingsGet.mockResolvedValue(snapshot({acceptingRequests:false}));const res=responseRecorder();await createSurrenderRequest(req(validBody()),res);expect(res.statusCode).toBe(503);expect(res.body.code).toBe("SURRENDER_REQUESTS_CLOSED");});
  it("Scenario 2 — returns HTTP 400 for missing reason or owner contact",async()=>{let res=responseRecorder();await createSurrenderRequest(req(validBody({surrenderReason:""})),res);expect(res.statusCode).toBe(400);res=responseRecorder();const body=validBody();delete body.owner.contact;await createSurrenderRequest(req(body),res);expect(res.statusCode).toBe(400);});
  it("Scenario 3 — returns HTTP 403 outside Angeles City or for unsupported barangay",async()=>{let res=responseRecorder();await createSurrenderRequest(req(validBody({owner:{...validBody().owner,city:"Mabalacat City"}})),res);expect(res.statusCode).toBe(403);res=responseRecorder();await createSurrenderRequest(req(validBody({owner:{...validBody().owner,barangay:"Unsupported"}})),res);expect(res.statusCode).toBe(403);});
  it("Scenario 4 — rejects missing/invalid front or back ID before NLP",async()=>{const body=validBody();delete body.owner.identityDocuments.back;const res=responseRecorder();await createSurrenderRequest(req(body),res);expect(res.statusCode).toBe(400);expect(analyzeSurrenderReason).not.toHaveBeenCalled();});
  it("Scenario 5 — accepts a complete request and permits an omitted animal photo",async()=>{const res=responseRecorder();await createSurrenderRequest(req(validBody()),res);expect(res.statusCode).toBe(201);expect(analyzeSurrenderReason).toHaveBeenCalledOnce();expect(requestSet).toHaveBeenCalledOnce();expect(res.body.request.pet.photoDataUrl).toBe("");});
});
