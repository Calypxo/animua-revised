const r=require("express").Router(),auth=require("../middleware/authMiddleware"),role=require("../middleware/roleMiddleware");
r.get("/",auth,role("Admin","Staff","Veterinarian"),require("../controllers/reportController").getReports);
module.exports=r;
