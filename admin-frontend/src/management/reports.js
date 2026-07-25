import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/reports.css";
import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser } from "../components/management/topbarUser.js";
import { loadSidebar } from "../components/management/sidebarLoader.js";
import { renderPageHeader } from "../components/management/pageHeader.js";
import { PAGE_HEADER_CONFIGS } from "../components/management/pageHeaderConfigs.js";
import { apiFetch } from "../utils/api.js";

const CONFIG = {
  intake: { label:"Animal Intake", icon:"bi-box-arrow-in-down", columns:[["date","Intake Date"],["id","Intake ID"],["animal","Description"],["source","Source"],["species","Species"],["status","Intake Status"],["conversion","Conversion"],["location","Location"]] },
  status: { label:"Animal Status", icon:"bi-heart-pulse-fill", columns:[["date","Intake Date"],["id","Animal ID"],["animal","Description"],["species","Species"],["status","Current Status"],["clearance","Clearance"],["assessment","Behavioral Assessment"]] },
  adoption: { label:"Adoption", icon:"bi-balloon-heart-fill", columns:[["date","Submitted"],["id","Application ID"],["animalId","Animal ID"],["animal","Shelter Description"],["applicant","Applicant"],["contact","Contact"],["source","Source"],["status","Status"],["adoptionDate","Adoption Date"],["adoptedName","Adopter-Given Name"]] },
  medical: { label:"Medical & Quarantine", icon:"bi-clipboard2-pulse-fill", columns:[["date","Date"],["animalId","Animal ID"],["animal","Description"],["type","Record Type"],["veterinarian","Veterinarian"],["diagnosis","Diagnosis"],["treatment","Treatment"],["inventoryItem","Inventory Used"],["quantityUsed","Qty"],["clearance","Clearance"]] },
  inventory: { label:"Inventory Usage", icon:"bi-box-seam-fill", columns:[["date","Usage Date"],["inventoryItem","Item"],["quantityUsed","Qty Used"],["unit","Unit"],["remainingStock","Remaining"],["stockStatus","Stock Status"],["animalId","Animal ID"],["animal","Description"],["type","Procedure"],["veterinarian","Veterinarian"]] },
  surrender: { label:"Surrender Requests", icon:"bi-file-earmark-text-fill", columns:[["date","Submitted"],["id","Request ID"],["owner","Owner"],["barangay","Barangay"],["animal","Animal Description"],["species","Species"],["category","NLP Category"],["urgency","Urgency"],["status","Status"]] },
};
let payload={available:[],reports:{}}, active="";
const esc=(v)=>String(v??"").replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const text=(v)=>v===null||v===undefined||v===""?"—":String(v);

function workspace(){
 document.querySelector(".page-body").innerHTML =
 '<div id="pageHeaderMount"></div>'+
 '<div class="rpt-card mb-4 report-filter-card"><div class="report-filter-grid"><label>From<input class="filter-select" type="date" id="dateFrom"></label><label>To<input class="filter-select" type="date" id="dateTo"></label><label>Search<input class="filter-select" type="search" id="reportSearch" placeholder="Search current report"></label><button class="btn-export" id="btnApply"><i class="bi bi-funnel-fill"></i> Apply</button><button class="btn-export report-secondary-btn" id="btnClear">Clear</button></div></div>'+
 '<div class="report-tabs mb-4" id="liveReportTabs"></div><div class="kpi-row mb-4" id="reportSummary"></div>'+
 '<div class="rpt-card"><div class="rpt-card-head"><div><h3 id="reportTitle">Report</h3><p id="reportMeta">Loading live records…</p></div></div><div class="table-responsive"><table class="rpt-table"><thead><tr id="reportHead"></tr></thead><tbody id="reportBody"></tbody></table></div></div>';
}
async function load(){
 const from=document.getElementById("dateFrom").value,to=document.getElementById("dateTo").value;
 if(from&&to&&from>to)throw new Error("The From date cannot be later than the To date.");
 const q=new URLSearchParams();if(from)q.set("from",from);if(to)q.set("to",to);
 payload=await apiFetch("/reports"+(q.size?"?"+q.toString():""));
 if(!payload.available.includes(active))active=payload.available[0]||"";
 tabs();render();
}
function tabs(){
 document.getElementById("liveReportTabs").innerHTML=payload.available.map((key)=>{
  const c=CONFIG[key];return '<button class="report-tab '+(key===active?"active":"")+'" data-report="'+key+'"><i class="bi '+c.icon+'"></i>'+esc(c.label)+"</button>";
 }).join("");
 document.querySelectorAll("[data-report]").forEach((button)=>button.addEventListener("click",()=>{active=button.dataset.report;tabs();render();}));
}
function rows(){
 const q=document.getElementById("reportSearch").value.toLowerCase().trim(),list=payload.reports[active]||[];
 return q?list.filter((row)=>Object.values(row).some((v)=>String(v??"").toLowerCase().includes(q))):list;
}
function summary(list){
 const counts={};list.forEach((row)=>{const s=row.status||row.clearance||"";if(s&&s!=="N/A")counts[s]=(counts[s]||0)+1;});
 document.getElementById("reportSummary").innerHTML=[["Records",list.length],...Object.entries(counts).slice(0,4)].map(([label,value])=>'<div class="rpt-kpi"><div class="rpt-kpi-val">'+value+'</div><div class="rpt-kpi-lbl">'+esc(label)+"</div></div>").join("");
}
function render(){
 const c=CONFIG[active];if(!c)return;
 const list=rows();
 const allCount=Object.values(payload.reports).reduce((total,records)=>total+(Array.isArray(records)?records.length:0),0);
 [["reportSourceCount",payload.available.length],["reportAllCount",allCount],["reportVisibleCount",list.length],["heroReportCount",list.length]].forEach(([id,value])=>{const element=document.getElementById(id);if(element)element.textContent=value;});
 document.getElementById("reportTitle").textContent=c.label+" Report";
 document.getElementById("reportMeta").textContent=list.length+" live record(s) · Generated "+new Date(payload.generatedAt).toLocaleString("en-PH");
 document.getElementById("reportHead").innerHTML=c.columns.map((x)=>"<th>"+esc(x[1])+"</th>").join("");
 document.getElementById("reportBody").innerHTML=list.length?list.map((row)=>"<tr>"+c.columns.map((x)=>"<td>"+esc(text(row[x[0]]))+"</td>").join("")+"</tr>").join(""):'<tr><td colspan="'+c.columns.length+'" class="text-center py-5 text-muted">No records match the selected filters.</td></tr>';
 summary(list);
}
function csv(){
 const c=CONFIG[active],list=rows();if(!c||!list.length)return;
 const quote=(v)=>'"'+text(v).replaceAll('"','""')+'"';
 const content=[c.columns.map((x)=>quote(x[1])).join(","),...list.map((row)=>c.columns.map((x)=>quote(row[x[0]])).join(","))].join("\r\n");
 const url=URL.createObjectURL(new Blob(["\ufeff"+content],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");
 a.href=url;a.download="animua-"+active+"-report-"+new Date().toISOString().slice(0,10)+".csv";a.click();URL.revokeObjectURL(url);
}
function error(e){console.error(e);const body=document.getElementById("reportBody");if(body)body.innerHTML='<tr><td class="text-danger">'+esc(e.message)+"</td></tr>";}
async function init(){
 try{
  await protectManagementPage();renderTopbarUser();loadSidebar();workspace();renderPageHeader(PAGE_HEADER_CONFIGS.reports);
  const now=new Date();document.getElementById("dateFrom").value=now.getFullYear()+"-01-01";document.getElementById("dateTo").value=now.toISOString().slice(0,10);
  document.getElementById("btnApply").addEventListener("click",()=>load().catch(error));
  document.getElementById("btnClear").addEventListener("click",()=>{
    document.getElementById("dateFrom").value="";
    document.getElementById("dateTo").value="";
    document.getElementById("reportSearch").value="";
    load().catch(error);
  });
  document.getElementById("reportSearch").addEventListener("input",render);
  document.getElementById("btnCsv").addEventListener("click",csv);
  document.getElementById("btnPrint").addEventListener("click",()=>window.print());
  await load();
 }catch(e){error(e)}finally{document.body.classList.remove("loading")}
}
window.addEventListener("DOMContentLoaded",init);
