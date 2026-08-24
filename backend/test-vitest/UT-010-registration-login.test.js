const { EventEmitter } = require("events");
const bcrypt = require("bcryptjs");
const { loadWithMocks, responseRecorder, snapshot } = require("./helpers/commonjs");

const verifyIdToken=vi.fn(); const userGet=vi.fn(); const userSet=vi.fn(); const userUpdate=vi.fn();
const doc=vi.fn(()=>({get:userGet,set:userSet,update:userUpdate}));
const db={collection:vi.fn(()=>({doc}))};
const admin={auth:()=>({verifyIdToken}),firestore:{FieldValue:{serverTimestamp:()=>"timestamp"}}};
const https={request:vi.fn((_url,_options,callback)=>{const request=new EventEmitter();request.write=vi.fn();request.end=()=>{const response=new EventEmitter();callback(response);queueMicrotask(()=>{response.emit("data",JSON.stringify({success:true}));response.emit("end");});};return request;})};

let auth;
beforeAll(()=>{process.env.RECAPTCHA_SECRET_KEY="unit-secret";auth=loadWithMocks("../src/controllers/authController",{"../src/config/firebase":{db,admin},"https":https,"nodemailer":{createTransport:vi.fn(()=>({}))}});});
afterAll(()=>{delete process.env.RECAPTCHA_SECRET_KEY;});
beforeEach(()=>{verifyIdToken.mockReset();userGet.mockReset();userSet.mockReset();userUpdate.mockReset();});

const registrationBody=(extra={})=>({fullName:"Ana User",email:"ana@test.com",password:"weak-is-accepted-here",firebaseUid:"uid-1",firebaseIdToken:"firebase-token",termsAccepted:true,policyVersion:"1.0",captchaToken:"captcha",...extra});

describe("UT-010 — Registration and Login Decisions",()=>{
  it("Scenario 1 — returns HTTP 400 when a required registration identity field is missing",async()=>{const res=responseRecorder();await auth.register({body:registrationBody({fullName:""})},res);expect(res.statusCode).toBe(400);});
  it("Scenario 2 — returns HTTP 400 when terms or the policy version are not accepted",async()=>{const res=responseRecorder();await auth.register({body:registrationBody({termsAccepted:false})},res);expect(res.statusCode).toBe(400);});
  it("Scenario 3 — returns HTTP 401 when decoded Firebase identity differs",async()=>{verifyIdToken.mockResolvedValue({uid:"other",email:"ana@test.com"});const res=responseRecorder();await auth.register({body:registrationBody(),ip:"127.0.0.1"},res);expect(res.statusCode).toBe(401);});
  it("Scenario 4 — returns HTTP 409 for an existing fully verified account",async()=>{verifyIdToken.mockResolvedValue({uid:"uid-1",email:"ana@test.com"});userGet.mockResolvedValue(snapshot({email:"ana@test.com"}));const res=responseRecorder();await auth.register({body:registrationBody(),ip:"127.0.0.1"},res);expect(res.statusCode).toBe(409);});
  it("Scenario 5 — returns 401 for a wrong active password and 403 for inactive status",async()=>{const hash=await bcrypt.hash("CorrectPass1!",4);userGet.mockResolvedValueOnce(snapshot({email:"ana@test.com",password:hash,status:"Active",role:"Public",emailVerified:true}));let res=responseRecorder();await auth.login({body:{email:"ana@test.com",password:"WrongPass1!"}},res);expect(res.statusCode).toBe(401);userGet.mockResolvedValueOnce(snapshot({email:"ana@test.com",password:hash,status:"Inactive"}));res=responseRecorder();await auth.login({body:{email:"ana@test.com",password:"CorrectPass1!"}},res);expect(res.statusCode).toBe(403);});
  it("Scenario 6 — rejects a management account on the public portal",async()=>{const hash=await bcrypt.hash("CorrectPass1!",4);userGet.mockResolvedValue(snapshot({email:"admin@test.com",password:hash,status:"Active",role:"Admin",emailVerified:true}));const res=responseRecorder();await auth.login({body:{email:"admin@test.com",password:"CorrectPass1!",portal:"public"}},res);expect(res.statusCode).toBe(403);expect(res.body.code).toBe("MANAGEMENT_PORTAL_REQUIRED");expect(res.cookies).toBeUndefined();});
});
