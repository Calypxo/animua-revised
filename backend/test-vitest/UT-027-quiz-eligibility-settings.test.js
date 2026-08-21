const { loadWithMocks, responseRecorder } = require("./helpers/commonjs");

let settings={},user={},results=[]; const settingsSet=vi.fn(),auditAdd=vi.fn();
const snap=(exists,data,id="doc")=>({exists,id,data:()=>data});
const db={collection:vi.fn(name=>{
  if(name==="quizSettings") return {doc:()=>({id:"compatibilityQuiz",get:vi.fn(async()=>snap(Object.keys(settings).length>0,settings)),set:settingsSet})};
  if(name==="users") return {doc:()=>({get:vi.fn(async()=>snap(true,user)),set:vi.fn()})};
  if(name==="compatibilityResults") return {where:()=>({get:vi.fn(async()=>({docs:results.map((data,index)=>({id:`R-${index}`,ref:{},data:()=>data}))}))})};
  if(name==="auditLogs") return {add:auditAdd};
  return {doc:()=>({get:vi.fn(async()=>snap(false,{}))})};
})};
const controller=loadWithMocks("../src/controllers/matchController",{
  "../src/config/firebase":{db,admin:{firestore:{FieldValue:{serverTimestamp:()=>"timestamp"},Timestamp:{fromDate:value=>value}}}},
  "../src/services/notificationService":{createManagementNotification:vi.fn().mockResolvedValue()},
});
const request={user:{id:"user@test.com",email:"user@test.com",fullName:"Ana",role:"Public"}};

describe("UT-027 — Quiz Eligibility and Administrative Settings",()=>{
  beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date("2026-08-12T00:00:00Z"));settings={quizEnabled:true,retakeCooldownDays:30,quizVersion:1};user={};results=[];settingsSet.mockReset().mockResolvedValue();auditAdd.mockReset().mockResolvedValue();});
  afterEach(()=>vi.useRealTimers());
  it("Scenario 1 — identifies an enabled first attempt",async()=>{const res=responseRecorder();await controller.getEligibility(request,res);expect(res.body).toMatchObject({canTakeQuiz:true,hasPreviousResult:false,reason:"FIRST_ATTEMPT"});});
  it("Scenario 2 — blocks a disabled quiz with QUIZ_DISABLED",async()=>{settings.quizEnabled=false;const res=responseRecorder();await controller.getEligibility(request,res);expect(res.body).toMatchObject({canTakeQuiz:false,reason:"QUIZ_DISABLED"});});
  it("Scenario 3 — blocks a future retake with at least one remaining day",async()=>{results=[{isLatest:true,completedAt:"2026-08-01T00:00:00Z",nextRetakeAt:"2026-08-20T00:00:00Z"}];const res=responseRecorder();await controller.getEligibility(request,res);expect(res.body).toMatchObject({canTakeQuiz:false,reason:"RETAKE_COOLDOWN"});expect(res.body.remainingDays).toBeGreaterThanOrEqual(1);});
  it("Scenario 4 — gives a valid user override precedence over the normal cooldown",async()=>{results=[{isLatest:true,nextRetakeAt:"2026-09-20T00:00:00Z"}];user.quizRetakeOverrideAt="2026-08-10T00:00:00Z";const res=responseRecorder();await controller.getEligibility(request,res);expect(res.body).toMatchObject({canTakeQuiz:true,reason:"RETAKE_AVAILABLE",nextRetakeAt:"2026-08-10T00:00:00.000Z"});});
  it.each([[0,1,true],[366,1,true],[1.5,1,true],[30,0,true],[30,1,"yes"]])("Scenario 5 — rejects invalid settings cooldown=%s version=%s enabled=%s",async(cooldown,version,enabled)=>{const res=responseRecorder();await controller.updateAdminSettings({body:{retakeCooldownDays:cooldown,quizVersion:version,quizEnabled:enabled},user:request.user},res);expect(res.statusCode).toBe(400);expect(settingsSet).not.toHaveBeenCalled();});
});
