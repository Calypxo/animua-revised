const { loadWithMocks } = require("./helpers/commonjs");

const add=vi.fn(); const get=vi.fn(); const whereGet=vi.fn();
const db={collection:vi.fn((name)=>name==="notifications"?{add}:{doc:()=>({get}),where:()=>({get:whereGet})})};
const notifications=loadWithMocks("../src/services/notificationService",{"../src/config/firebase":{db,admin:{firestore:{FieldValue:{serverTimestamp:()=>"timestamp"}}}}});

describe("UT-030 — Notification Preferences",()=>{
  beforeEach(()=>{add.mockReset().mockResolvedValue({id:"N-1"});get.mockReset();whereGet.mockReset();});
  it("Scenario 1 — defaults every implemented category to enabled",()=>expect(notifications.normalizeNotificationSettings({})).toEqual({applicationUpdates:true,surrenderRequestUpdates:true,announcementsEvents:true}));
  it("Scenario 2 — preserves an explicit application opt-out",()=>expect(notifications.normalizeNotificationSettings({applicationUpdates:false})).toEqual({applicationUpdates:false,surrenderRequestUpdates:true,announcementsEvents:true}));
  it("Scenario 3 — returns null and performs no write for whitespace email",async()=>{await expect(notifications.createUserNotification({userEmail:"   "})).resolves.toBeNull();expect(add).not.toHaveBeenCalled();});
  it("Scenario 4 — returns null when application updates are disabled",async()=>{get.mockResolvedValue({exists:true,data:()=>({notificationSettings:{applicationUpdates:false}})});await expect(notifications.createUserNotification({userEmail:"user@test.com",category:"application"})).resolves.toBeNull();expect(add).not.toHaveBeenCalled();});
  it("Scenario 5 — normalizes email and stores an unread notification",async()=>{get.mockResolvedValue({exists:true,data:()=>({notificationSettings:{}})});await expect(notifications.createUserNotification({userEmail:" User@Test.COM ",title:" Update "})).resolves.toBe("N-1");expect(add).toHaveBeenCalledWith(expect.objectContaining({userEmail:"user@test.com",read:false,title:"Update"}));});
});
