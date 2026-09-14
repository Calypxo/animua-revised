const { loadWithMocks, responseRecorder, snapshot } = require("./helpers/commonjs");
const { getAdoptionFinalizationError } = require("../src/services/adoptionWorkflowService");
const deadlines = require("../src/services/requestDeadlineService");

const records=new Map(); const updates=[];
const ref=(collection,id)=>({get:vi.fn(async()=>snapshot(records.get(`${collection}/${id}`),id)),update:vi.fn(async data=>updates.push([collection,id,data]))});
const db={collection:vi.fn(name=>({doc:id=>ref(name,id),where:()=>({get:vi.fn(async()=>({size:0}))})})),batch:vi.fn(()=>({update:vi.fn(),commit:vi.fn()})),runTransaction:vi.fn(async callback=>callback({get:reference=>reference.get(),update:(reference,data)=>reference.update(data)}))};
const controller=loadWithMocks("../src/controllers/adoptionController",{
  "../src/config/firebase":{db,admin:{firestore:{FieldValue:{serverTimestamp:()=>"timestamp",arrayUnion:x=>x}}}},
  "../src/services/notificationService":{createUserNotification:vi.fn().mockResolvedValue(),createManagementNotification:vi.fn().mockResolvedValue()},
});

describe("UT-017 — Adoption Submission and Finalization Prerequisites",()=>{
  beforeEach(()=>{records.clear();updates.length=0;});
  it("Scenario 1 — rejects an adoption route request without authentication",async()=>{const auth=loadWithMocks("../src/middleware/authMiddleware",{"../src/config/firebase":{db:{}}});const res=responseRecorder(),next=vi.fn();await auth({headers:{}},res,next);expect(res.statusCode).toBe(401);expect(next).not.toHaveBeenCalled();});
  it("Scenario 2 — createAdoption returns HTTP 400 without pet_id",async()=>{const res=responseRecorder();await controller.createAdoption({body:{},user:{email:"user@test.com"}},res);expect(res.statusCode).toBe(400);});
  it("Scenario 3 — createAdoption returns HTTP 400 for a non-Ready animal",async()=>{records.set("animals/A",{status:"Quarantine"});const res=responseRecorder();await controller.createAdoption({body:{pet_id:"A"},user:{email:"user@test.com"}},res);expect(res.statusCode).toBe(400);});
  it("Scenario 4 — rejects Pending finalization even with confirmed arrival",()=>expect(getAdoptionFinalizationError({status:"Pending",arrivalConfirmedAt:"2026-08-11T02:00:00Z"})).toMatch(/only approved/i));
  it("Scenario 5 — finds no prerequisite error for Approved with confirmed arrival",()=>expect(getAdoptionFinalizationError({status:"Approved",arrivalConfirmedAt:"2026-08-11T02:00:00Z"})).toBe(""));
});

describe("UT-018 — Adoption Scheduling and Finalization Rules",()=>{
  beforeEach(()=>{records.clear();updates.length=0;});
  const scheduleReq=(body={date:"2026-08-05",time:"09:00"})=>({params:{id:"APP-1"},body,user:{email:"owner@test.com"}});
  it("Scenario 1 — returns HTTP 403 when the authenticated user is not the owner",async()=>{records.set("adoptions/APP-1",{status:"Approved",applicant:{email:"other@test.com"}});const res=responseRecorder();await controller.scheduleMyAdoptionPickup(scheduleReq(),res);expect(res.statusCode).toBe(403);});
  it("Scenario 2 — returns HTTP 400 when pickup exceeds the attendance deadline",async()=>{records.set("adoptions/APP-1",{status:"Approved",applicant:{email:"owner@test.com"},attendanceDeadlineAt:"2026-08-10T15:59:59.999Z"});const res=responseRecorder();await controller.scheduleMyAdoptionPickup(scheduleReq({date:"2099-08-11",time:"09:00"}),res);expect(res.statusCode).toBe(400);});
  it("Scenario 3 — directly saves the one allowed pickup reschedule as final",async()=>{const now=new Date();const originalDate=new Date(now.getTime()+86400000).toISOString().slice(0,10);const newDate=new Date(now.getTime()+2*86400000).toISOString().slice(0,10);records.set("adoptions/APP-1",{status:"Approved",applicant:{email:"owner@test.com"},attendanceDeadlineAt:new Date(now.getTime()+10*86400000).toISOString(),pickupSchedule:{date:originalDate,time:"09:00",scheduledAt:"original"}});const res=responseRecorder();await controller.scheduleMyAdoptionPickup(scheduleReq({date:newDate,time:"10:00"}),res);expect(res.statusCode).toBe(200);expect(res.body.finalReschedule).toBe(true);expect(res.body.reschedulesRemaining).toBe(0);expect(res.body.pickupSchedule).toMatchObject({date:newDate,time:"10:00",rescheduleCount:1,previousSchedule:{date:originalDate,time:"09:00"}});expect(res.body.pickupSchedule.rescheduleHistory).toHaveLength(1);expect(updates[0][2]).toMatchObject({pickupRescheduleRequest:null,deadlineStatus:"Appointment Scheduled",noShowRisk:false});});
  it("Scenario 4 — rejects a second pickup reschedule",async()=>{const now=new Date();const future=new Date(now.getTime()+86400000).toISOString().slice(0,10);records.set("adoptions/APP-1",{status:"Approved",applicant:{email:"owner@test.com"},attendanceDeadlineAt:new Date(now.getTime()+10*86400000).toISOString(),pickupSchedule:{date:future,time:"09:00",rescheduleCount:1,rescheduledAt:now.toISOString()}});const res=responseRecorder();await controller.scheduleMyAdoptionPickup(scheduleReq({date:future,time:"10:00"}),res);expect(res.statusCode).toBe(400);expect(res.body.message).toMatch(/only be rescheduled once/i);});
  it("Scenario 6 — rejectAdoption returns HTTP 400 for a blank reason",async()=>{const res=responseRecorder();await controller.rejectAdoption({params:{id:"APP-1"},body:{reason:"  "}},res);expect(res.statusCode).toBe(400);});
  it("Scenario 7 — finalizeAdoption rejects adopted names shorter than two characters",async()=>{const res=responseRecorder();await controller.finalizeAdoption({params:{id:"APP-1"},body:{adoptedName:"A"},user:{}},res);expect(res.statusCode).toBe(400);expect(res.body.message).toMatch(/between 2 and 60/);});
});
