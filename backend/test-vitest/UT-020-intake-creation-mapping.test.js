const { loadWithMocks, responseRecorder, snapshot } = require("./helpers/commonjs");

const records=new Map(); let duplicate=false; const batchSet=vi.fn(),batchUpdate=vi.fn(),batchCommit=vi.fn();
const docRef=(name,id)=>({id,get:vi.fn(async()=>snapshot(records.get(`${name}/${id}`),id)),update:vi.fn(),set:vi.fn()});
const db={
  collection:vi.fn(name=>({
    doc:id=>docRef(name,id),
    where:vi.fn(field=>({
      limit:()=>({get:vi.fn(async()=>({empty:!duplicate,docs:duplicate?[{}]:[]}))}),
      get:vi.fn(async()=>({size:0,empty:true,docs:[]})),
    })),
  })),
  batch:vi.fn(()=>({set:batchSet,update:batchUpdate,commit:batchCommit})),
};
const controller=loadWithMocks("../src/controllers/intakeController",{
  "../src/config/firebase":{db,admin:{firestore:{FieldValue:{serverTimestamp:()=>"timestamp",arrayUnion:x=>x}}}},
});
const user={email:"staff@test.com",fullName:"Staff User"};
const complete=(extra={})=>({identifyingDescription:"Brown dog",species:"Dog",sex:"Male",condition:"Stable",source:"Rescue",intakeDate:"2026-08-12",location:"Pampang",status:"Pending",...extra});

describe("UT-020 — Intake Creation and Animal Profile Mapping",()=>{
  beforeEach(()=>{records.clear();duplicate=false;batchSet.mockReset();batchUpdate.mockReset();batchCommit.mockReset().mockResolvedValue();});
  it("Scenario 1 — returns HTTP 400 for an incomplete submitted Pending intake",async()=>{const res=responseRecorder();await controller.createIntake({body:complete({identifyingDescription:"",color:""}),user},res);expect(res.statusCode).toBe(400);});
  it("Scenario 2 — returns HTTP 400 for an invalid source and missing impound barangay",async()=>{let res=responseRecorder();await controller.createIntake({body:complete({source:"Unknown"}),user},res);expect(res.statusCode).toBe(400);res=responseRecorder();await controller.createIntake({body:complete({source:"Barangay Impound"}),user},res);expect(res.statusCode).toBe(400);});
  it("Scenario 3 — applies 400, 404, and 409 surrender-reference decisions",async()=>{let res=responseRecorder();await controller.createIntake({body:complete({source:"Approved Surrender"}),user},res);expect(res.statusCode).toBe(400);records.set("surrenderRequests/SR-X",undefined);res=responseRecorder();await controller.createIntake({body:complete({source:"Approved Surrender",surrenderRefId:"SR-X"}),user},res);expect(res.statusCode).toBe(404);records.set("surrenderRequests/SR-X",{status:"Approved",arrivalConfirmedAt:"2026-08-12T01:00:00Z"});duplicate=true;res=responseRecorder();await controller.createIntake({body:complete({source:"Approved Surrender",surrenderRefId:"SR-X"}),user},res);expect(res.statusCode).toBe(409);});
  it("Scenario 4 — atomically creates a Pending linked intake without creating an animal profile",async()=>{records.set("surrenderRequests/SR-1",{status:"Approved",arrivalConfirmedAt:"2026-08-12T01:00:00Z"});const res=responseRecorder();await controller.createIntake({body:complete({source:"Approved Surrender",surrenderRefId:"SR-1"}),user},res);expect(res.statusCode).toBe(201);expect(res.body.status).toBe("Pending");expect(res.body.animalProfileId).toBeNull();expect(batchSet).toHaveBeenCalledTimes(1);expect(batchSet.mock.calls[0][1]).toMatchObject({status:"Pending",animalProfileId:null,surrenderRefId:"SR-1"});expect(batchUpdate).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({status:"Converted",intakeId:expect.stringMatching(/^INT-/)}));expect(batchCommit).toHaveBeenCalledOnce();});
  it("Scenario 5 — returns HTTP 409 for an otherwise advanceable intake with animalProfileId",async()=>{records.set("intakeRecords/INT-1",{status:"Pending",animalProfileId:"ANIM-1"});const res=responseRecorder();await controller.convertToProfile({params:{id:"INT-1"},user},res);expect(res.statusCode).toBe(409);});
});
