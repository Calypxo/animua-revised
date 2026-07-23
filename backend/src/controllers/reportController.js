const {db}=require("../config/firebase");
const {buildShelterLabel}=require("../utils/animalIdentity");
const dt=v=>{if(!v)return"";const d=typeof v.toDate==="function"?v.toDate():new Date((v._seconds??v.seconds)?(v._seconds??v.seconds)*1000:v);return isNaN(d)?"":d.toISOString().slice(0,10)};
const ok=(v,q)=>(!q.from||dt(v)>=q.from)&&(!q.to||dt(v)<=q.to);
const stockStatus=i=>{const current=Number(i.currentStock??i.quantity??i.stock??0),reorder=Number(i.reorderPoint??i.minimumStock??i.minStock??0),critical=Number(i.criticalPoint??Math.max(1,Math.floor(reorder/2)));return current<=critical?"Critical":reorder&&current<=reorder?"Low":"OK"};
exports.getReports=async(req,res)=>{try{
 const ss=await Promise.all(["intakeRecords","animals","adoptions","surrenderRequests","inventoryItems"].map(n=>db.collection(n).get()));
 const [ins,ans,ads,srs,inv]=ss.map(s=>s.docs.map(d=>({id:d.id,...d.data()}))), im=new Map(inv.map(x=>[x.id,x]));
 const reports={
 intake:ins.filter(x=>ok(x.intakeDate||x.createdAt,req.query)).map(x=>({date:dt(x.intakeDate||x.createdAt),id:x.id,animal:buildShelterLabel(x,x.id),source:x.source,species:x.species,status:x.status,conversion:x.animalProfileId?"Converted":"Not converted",location:x.location})),
 status:ans.filter(x=>ok(x.intakeDate||x.createdAt,req.query)).map(x=>({date:dt(x.intakeDate||x.createdAt),id:x.id,animal:buildShelterLabel(x,x.id),species:x.species,status:x.status,clearance:x.quarantineClearance||"N/A",assessment:x.behavioralAssessment?"Complete":"Pending"})),
 adoption:ads.filter(x=>ok(x.submittedAt||x.createdAt,req.query)).map(x=>({date:dt(x.submittedAt||x.createdAt),id:x.applicationId||x.id,animalId:x.pet_id,animal:x.pet_label||x.pet_name,applicant:x.applicant?.full_name,contact:x.applicant?.contact_number,status:x.status,source:x.compatibility?"Quiz":"Browse",adoptionDate:dt(x.adoptionDate),adoptedName:x.adoptedName||""})),
 medical:[],inventory:[],
 surrender:srs.filter(x=>ok(x.createdAt||x.submittedAt,req.query)).map(x=>({date:dt(x.createdAt||x.submittedAt),id:x.id,owner:x.owner?.name,barangay:x.owner?.barangay,animal:x.pet?.colorMarkings||x.pet?.name,species:x.pet?.species,status:x.status,category:x.nlp?.category||x.nlp?.classification||"",urgency:x.nlp?.urgency||x.nlp?.urgencyLevel||""}))
 };
 ans.forEach(a=>(a.medicalRecords||[]).forEach(m=>{if(!ok(m.date,req.query))return;const i=im.get(m.inventoryItemId)||{},r={date:dt(m.date),animalId:a.id,animal:buildShelterLabel(a,a.id),type:m.type,veterinarian:m.vet,diagnosis:m.diagnosis,treatment:m.treatment,inventoryItem:m.inventoryItemName||i.name||i.itemDescription||"",quantityUsed:Number(m.quantityUsed||0),unit:m.inventoryUnit||i.unit||"",clearance:m.clearance||"N/A"};reports.medical.push(r);if(r.quantityUsed)reports.inventory.push({...r,remainingStock:Number(i.currentStock??i.quantity??i.stock??0),stockStatus:stockStatus(i)});}));
 const roles={Admin:["intake","status","adoption","medical","inventory","surrender"],Staff:["intake","status","adoption","surrender"],Veterinarian:["status","medical","inventory"]},available=roles[req.user.role]||[];
 res.json({generatedAt:new Date().toISOString(),available,reports:Object.fromEntries(available.map(k=>[k,reports[k]]))});
}catch(e){console.error("[reports]",e);res.status(500).json({message:"Failed to generate live reports."})}};
