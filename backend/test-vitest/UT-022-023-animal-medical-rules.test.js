const { loadWithMocks, responseRecorder, snapshot } = require("./helpers/commonjs");

const records=new Map(); const directUpdate=vi.fn(),txUpdate=vi.fn(),txSet=vi.fn();
const makeRef=(collectionName,id="generated")=>({_collection:collectionName,id,get:vi.fn(async()=>snapshot(records.get(`${collectionName}/${id}`),id)),update:directUpdate,collection:sub=>({doc:()=>makeRef(`${collectionName}/${id}/${sub}`)})});
const db={
  collection:vi.fn(name=>({doc:id=>makeRef(name,id),add:vi.fn().mockResolvedValue(),where:()=>({limit:()=>({get:vi.fn(async()=>({size:0,docs:[]}))})})})),
  runTransaction:vi.fn(async callback=>callback({get:async ref=>snapshot(records.get(`${ref._collection}/${ref.id}`),ref.id),update:txUpdate,set:txSet})),
};
const admin={firestore:{FieldValue:{serverTimestamp:()=>"timestamp",arrayUnion:x=>x,delete:()=>"delete"}}};
const controller=loadWithMocks("../src/controllers/animalController",{"../src/config/firebase":{db,admin,bucket:{}}});
const user={email:"vet@test.com",fullName:"Vet User"};
const requiredTraits=()=>Object.fromEntries(["energyLevel","exerciseNeeds","independenceLevel","attentionNeeds","playfulness","friendlinessToHumans","goodWithKids","goodWithOtherPets","strangerTolerance","noiseLevel","spaceNeeds","adaptability","trainingDifficulty","affectionLevel","separationAnxiety","aggressive","specialNeeds"].map(key=>[key,3]));

describe("UT-022 — Behavioral Assessment and Quarantine Readiness",()=>{
  beforeEach(()=>{records.clear();directUpdate.mockReset();txUpdate.mockReset();txSet.mockReset();});
  it("Scenario 1 — identifies a missing aggressive trait with HTTP 400",async()=>{const traits=requiredTraits();delete traits.aggressive;const res=responseRecorder();await controller.saveBehavioralAssessment({params:{id:"A"},body:{traits},user},res);expect(res.statusCode).toBe(400);expect(res.body.message).toMatch(/aggress/i);});
  it("Scenario 2 — rejects energyLevel 6 with HTTP 400",async()=>{const traits=requiredTraits();traits.energyLevel=6;const res=responseRecorder();await controller.saveBehavioralAssessment({params:{id:"A"},body:{traits},user},res);expect(res.statusCode).toBe(400);});
  it("Scenario 3 — rejects sending a Ready animal to Quarantine",async()=>{records.set("animals/A",{status:"Ready"});const res=responseRecorder();await controller.sendToQuarantine({params:{id:"A"},user},res);expect(res.statusCode).toBe(400);});
  it("Scenario 4 — refuses Ready status without clearance or behavioral assessment",async()=>{records.set("animals/A",{status:"Quarantine",medicalRecords:[]});let res=responseRecorder();await controller.markReadyForAdoption({params:{id:"A"},user},res);expect(res.statusCode).toBe(400);records.set("animals/A",{status:"Quarantine",medicalRecords:[{type:"Quarantine Clearance",date:"2026-08-12",clearance:"Cleared"}]});res=responseRecorder();await controller.markReadyForAdoption({params:{id:"A"},user},res);expect(res.statusCode).toBe(400);expect(res.body.message).toMatch(/Behavioral assessment/);});
});

describe("UT-023 — Medical Record and Medical Inventory Rules",()=>{
  beforeEach(()=>{records.clear();directUpdate.mockReset();txUpdate.mockReset();txSet.mockReset();});
  const medical=(quantityUsed,inventoryItemId="")=>({params:{id:"A"},body:{type:"Checkup",date:"2026-08-12",quantityUsed,inventoryItemId},user});
  it("Scenario 1 — accepts empty/zero/two whole quantities and rejects negative/fractional quantities",async()=>{records.set("animals/A",{status:"Quarantine",medicalRecords:[]});for(const value of ["",0]){const res=responseRecorder();await controller.addMedicalRecord(medical(value),res);expect(res.statusCode).toBe(201);}for(const value of [-1,1.5]){const res=responseRecorder();await controller.addMedicalRecord(medical(value),res);expect(res.statusCode).toBe(400);}records.set("inventoryItems/M",{category:"Vaccine",currentStock:5,name:"Medicine"});const res=responseRecorder();await controller.addMedicalRecord(medical(2,"M"),res);expect(res.statusCode).toBe(201);});
  it("Scenario 2 — rejects invalid inventory item/quantity pairs",async()=>{let res=responseRecorder();await controller.addMedicalRecord(medical(0,"M"),res);expect(res.statusCode).toBe(400);res=responseRecorder();await controller.addMedicalRecord(medical(2,""),res);expect(res.statusCode).toBe(400);});
  it("Scenario 3 — rejects an invalid medical type or date",async()=>{let res=responseRecorder();await controller.addMedicalRecord({params:{id:"A"},body:{type:"Unknown",date:"2026-08-12"},user},res);expect(res.statusCode).toBe(400);res=responseRecorder();await controller.addMedicalRecord({params:{id:"A"},body:{type:"Checkup",date:"not-a-date"},user},res);expect(res.statusCode).toBe(400);});
  it("Scenario 4 — uses the latest clearance and the later array item on a date tie",async()=>{records.set("animals/A",{status:"Quarantine",behavioralAssessment:{done:true},medicalRecords:[{type:"Quarantine Clearance",date:"2026-08-10",clearance:"Hold"},{type:"Quarantine Clearance",date:"2026-08-11",clearance:"Hold"},{type:"Quarantine Clearance",date:"2026-08-11",clearance:"Cleared"}]});const res=responseRecorder();await controller.markReadyForAdoption({params:{id:"A"},user},res);expect(res.statusCode).toBe(200);expect(directUpdate).toHaveBeenCalledWith(expect.objectContaining({status:"Ready",quarantineClearance:"Cleared"}));});
  it("Scenario 5 — rejects excessive stock or a non-medical category without transaction writes",async()=>{records.set("animals/A",{status:"Quarantine",medicalRecords:[]});records.set("inventoryItems/M",{category:"Vaccine",currentStock:1,name:"Medicine"});let res=responseRecorder();await controller.addMedicalRecord(medical(2,"M"),res);expect(res.statusCode).toBe(409);expect(txUpdate).not.toHaveBeenCalled();records.set("inventoryItems/M",{category:"Food",currentStock:10,name:"Food"});res=responseRecorder();await controller.addMedicalRecord(medical(2,"M"),res);expect(res.statusCode).toBe(400);expect(txUpdate).not.toHaveBeenCalled();});
});
