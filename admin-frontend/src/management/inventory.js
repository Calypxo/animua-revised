// admin-frontend/src/management/inventory.js
// ─────────────────────────────────────────────────────
// MOCK PAGE — data is inline, no JSON import, no API call.
// When backend is ready:
//   1. Seed Firestore using seedInventory.js (from inventoryData.json)
//   2. Replace MOCK_INVENTORY below with: await apiFetch("/inventory")
//   3. Replace addStock / deductStock with API calls to
//      POST /api/inventory/:id/stock-in
//      POST /api/inventory/:id/use
// ─────────────────────────────────────────────────────
import "../css/adminDashboard.css";
import "../css/sidebar.css";
import "../css/inventory.css";

import { protectManagementPage } from "../auth/authGuard.js";
import { renderTopbarUser }      from "../components/management/topbarUser.js";
import { loadSidebar }           from "../components/management/sidebarLoader.js";
import { getUserName }           from "../utils/storage.js";

/* ══════════════════════════════════════════════════════
   MOCK INVENTORY — 81 items from Inventory.xlsx
   Fields reference:
     id, name, unit, category
     currentStock, averageInventory, avgMonthlyUsage
     recencyDays, leadTimeDays, stockoutFrequency
     monthlyTurnoverRatio, movementLabel, reorderRisk
     daysUntilStockout (derived: currentStock/avgMonthlyUsage*30)
     reorderPoint     (derived: avgMonthlyUsage/30 * leadTimeDays)
══════════════════════════════════════════════════════ */
const MOCK_INVENTORY = [
  // ── ANESTHETIC (2) ─────────────────────────────────
  { id:"ITM042", name:"Lidocaine 2%",                       unit:"btls",  category:"Anesthetic",         currentStock:11,  averageInventory:14,  avgMonthlyUsage:5,   recencyDays:14, leadTimeDays:9,  stockoutFrequency:0, monthlyTurnoverRatio:0.3571, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:66  },
  { id:"ITM077", name:"Zoletil",                            unit:"btls",  category:"Anesthetic",         currentStock:25,  averageInventory:31,  avgMonthlyUsage:16,  recencyDays:8,  leadTimeDays:10, stockoutFrequency:0, monthlyTurnoverRatio:0.5161, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:47  },
  // ── ANTIBIOTIC (15) ────────────────────────────────
  { id:"ITM003", name:"Amoxicilin sc route-DYFAMOX LA",     unit:"btls",  category:"Antibiotic",         currentStock:34,  averageInventory:40,  avgMonthlyUsage:25,  recencyDays:3,  leadTimeDays:7,  stockoutFrequency:1, monthlyTurnoverRatio:0.6250, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:41  },
  { id:"ITM007", name:"Baytril 5%",                        unit:"btls",  category:"Antibiotic",         currentStock:36,  averageInventory:42,  avgMonthlyUsage:21,  recencyDays:5,  leadTimeDays:8,  stockoutFrequency:1, monthlyTurnoverRatio:0.5000, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:51  },
  { id:"ITM017", name:"Co-Amoxiclav Suspension",           unit:"btls",  category:"Antibiotic",         currentStock:38,  averageInventory:45,  avgMonthlyUsage:22,  recencyDays:5,  leadTimeDays:8,  stockoutFrequency:1, monthlyTurnoverRatio:0.4889, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:52  },
  { id:"ITM018", name:"Co-Amoxiclav",                      unit:"boxes", category:"Antibiotic",         currentStock:19,  averageInventory:24,  avgMonthlyUsage:12,  recencyDays:8,  leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.5000, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:48  },
  { id:"ITM027", name:"Doxycycline 5%+Colistin+Bromhexine",unit:"btls",  category:"Antibiotic",         currentStock:27,  averageInventory:33,  avgMonthlyUsage:15,  recencyDays:8,  leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.4545, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:54  },
  { id:"ITM028", name:"Doxycycline tablet",                unit:"btls",  category:"Antibiotic",         currentStock:18,  averageInventory:22,  avgMonthlyUsage:11,  recencyDays:10, leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.5000, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:49  },
  { id:"ITM029", name:"Doxycycline Suspension",            unit:"btls",  category:"Antibiotic",         currentStock:21,  averageInventory:26,  avgMonthlyUsage:13,  recencyDays:8,  leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.5000, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:49  },
  { id:"ITM033", name:"Enrocep tablet 100mg/50mg",         unit:"boxes", category:"Antibiotic",         currentStock:17,  averageInventory:22,  avgMonthlyUsage:10,  recencyDays:11, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.4545, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:51  },
  { id:"ITM034", name:"Gentin",                            unit:"btls",  category:"Antibiotic",         currentStock:13,  averageInventory:16,  avgMonthlyUsage:6,   recencyDays:13, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.3750, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:65  },
  { id:"ITM045", name:"Marbocyl 2%",                       unit:"btls",  category:"Antibiotic",         currentStock:8,   averageInventory:10,  avgMonthlyUsage:3,   recencyDays:19, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.3000, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:80  },
  { id:"ITM046", name:"Metronidazole 50mg",                unit:"btls",  category:"Antibiotic",         currentStock:27,  averageInventory:33,  avgMonthlyUsage:16,  recencyDays:7,  leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.4848, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:51  },
  { id:"ITM052", name:"Oxytetracycline 20% OXYVET",        unit:"btls",  category:"Antibiotic",         currentStock:14,  averageInventory:18,  avgMonthlyUsage:7,   recencyDays:12, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.3889, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  { id:"ITM059", name:"Papi scour (Co-Trimoxazole)",       unit:"btls",  category:"Antibiotic",         currentStock:12,  averageInventory:16,  avgMonthlyUsage:6,   recencyDays:12, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.3750, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  { id:"ITM063", name:"Scourbust",                         unit:"btls",  category:"Antibiotic",         currentStock:33,  averageInventory:40,  avgMonthlyUsage:20,  recencyDays:6,  leadTimeDays:8,  stockoutFrequency:1, monthlyTurnoverRatio:0.5000, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:50  },
  { id:"ITM064", name:"Septotryl",                         unit:"btls",  category:"Antibiotic",         currentStock:8,   averageInventory:10,  avgMonthlyUsage:3,   recencyDays:19, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.3000, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:80  },
  // ── ANTIFUNGAL (1) ─────────────────────────────────
  { id:"ITM035", name:"Itraconazole tablet 10x10 box",     unit:"boxes", category:"Antifungal",         currentStock:14,  averageInventory:18,  avgMonthlyUsage:7,   recencyDays:12, leadTimeDays:9,  stockoutFrequency:0, monthlyTurnoverRatio:0.3889, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  // ── ANTIPARASITIC (7) ──────────────────────────────
  { id:"ITM038", name:"Ivomec",                            unit:"btls",  category:"Antiparasitic",      currentStock:12,  averageInventory:15,  avgMonthlyUsage:6,   recencyDays:12, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.4000, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  { id:"ITM040", name:"Levamisole",                        unit:"pack",  category:"Antiparasitic",      currentStock:14,  averageInventory:18,  avgMonthlyUsage:7,   recencyDays:10, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.3889, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  { id:"ITM048", name:"Microzole (Albendazole)",           unit:"btls",  category:"Antiparasitic",      currentStock:39,  averageInventory:48,  avgMonthlyUsage:24,  recencyDays:4,  leadTimeDays:8,  stockoutFrequency:1, monthlyTurnoverRatio:0.5000, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:49  },
  { id:"ITM066", name:"Simparica trio (10-20kg)",          unit:"boxes", category:"Antiparasitic",      currentStock:19,  averageInventory:24,  avgMonthlyUsage:11,  recencyDays:9,  leadTimeDays:9,  stockoutFrequency:0, monthlyTurnoverRatio:0.4583, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:52  },
  { id:"ITM067", name:"Simparica trio (20-40kg)",          unit:"boxes", category:"Antiparasitic",      currentStock:20,  averageInventory:26,  avgMonthlyUsage:12,  recencyDays:9,  leadTimeDays:9,  stockoutFrequency:0, monthlyTurnoverRatio:0.4615, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:50  },
  { id:"ITM073", name:"Vermifuge Oral Suspension",         unit:"btls",  category:"Antiparasitic",      currentStock:16,  averageInventory:21,  avgMonthlyUsage:9,   recencyDays:10, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.4286, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:53  },
  { id:"ITM074", name:"Vermifuge Tablets",                 unit:"btls",  category:"Antiparasitic",      currentStock:15,  averageInventory:20,  avgMonthlyUsage:8,   recencyDays:11, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.4000, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:56  },
  // ── CONSUMABLE (12) ────────────────────────────────
  { id:"ITM001", name:"Absorbent pads",                    unit:"pack",  category:"Consumable",         currentStock:42,  averageInventory:48,  avgMonthlyUsage:18,  recencyDays:6,  leadTimeDays:5,  stockoutFrequency:1, monthlyTurnoverRatio:0.3750, movementLabel:"Slow", reorderRisk:"Review", daysUntilStockout:70  },
  { id:"ITM020", name:"Cotton rolls",                      unit:"rolls", category:"Consumable",         currentStock:20,  averageInventory:24,  avgMonthlyUsage:9,   recencyDays:10, leadTimeDays:4,  stockoutFrequency:0, monthlyTurnoverRatio:0.3750, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:67  },
  { id:"ITM021", name:"Disposable Gloves (Large)",         unit:"boxes", category:"Consumable",         currentStock:22,  averageInventory:27,  avgMonthlyUsage:14,  recencyDays:7,  leadTimeDays:5,  stockoutFrequency:1, monthlyTurnoverRatio:0.5185, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:47  },
  { id:"ITM022", name:"Disposable Gloves (Medium)",        unit:"boxes", category:"Consumable",         currentStock:25,  averageInventory:29,  avgMonthlyUsage:16,  recencyDays:5,  leadTimeDays:5,  stockoutFrequency:1, monthlyTurnoverRatio:0.5517, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:47  },
  { id:"ITM023", name:"Disposable Needle G21",             unit:"boxes", category:"Consumable",         currentStock:32,  averageInventory:38,  avgMonthlyUsage:22,  recencyDays:4,  leadTimeDays:5,  stockoutFrequency:1, monthlyTurnoverRatio:0.5789, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:44  },
  { id:"ITM024", name:"Disposable Needle G23",             unit:"boxes", category:"Consumable",         currentStock:29,  averageInventory:34,  avgMonthlyUsage:19,  recencyDays:5,  leadTimeDays:5,  stockoutFrequency:1, monthlyTurnoverRatio:0.5588, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:46  },
  { id:"ITM025", name:"Disposable Syringe 1cc",            unit:"boxes", category:"Consumable",         currentStock:34,  averageInventory:40,  avgMonthlyUsage:24,  recencyDays:4,  leadTimeDays:5,  stockoutFrequency:1, monthlyTurnoverRatio:0.6000, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:43  },
  { id:"ITM026", name:"Disposable Syringe 3cc",            unit:"boxes", category:"Consumable",         currentStock:36,  averageInventory:42,  avgMonthlyUsage:26,  recencyDays:3,  leadTimeDays:5,  stockoutFrequency:1, monthlyTurnoverRatio:0.6190, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:42  },
  { id:"ITM037", name:"IV Line",                           unit:"pcs",   category:"Consumable",         currentStock:24,  averageInventory:29,  avgMonthlyUsage:15,  recencyDays:6,  leadTimeDays:5,  stockoutFrequency:0, monthlyTurnoverRatio:0.5172, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:48  },
  { id:"ITM041", name:"Leukoplast 4 inches",               unit:"pack",  category:"Consumable",         currentStock:9,   averageInventory:11,  avgMonthlyUsage:4,   recencyDays:17, leadTimeDays:5,  stockoutFrequency:0, monthlyTurnoverRatio:0.3636, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:68  },
  { id:"ITM047", name:"Micropore 1 inch",                  unit:"boxes", category:"Consumable",         currentStock:14,  averageInventory:18,  avgMonthlyUsage:7,   recencyDays:11, leadTimeDays:5,  stockoutFrequency:0, monthlyTurnoverRatio:0.3889, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  { id:"ITM069", name:"Sterile Gauze",                     unit:"boxes", category:"Consumable",         currentStock:18,  averageInventory:23,  avgMonthlyUsage:9,   recencyDays:10, leadTimeDays:5,  stockoutFrequency:0, monthlyTurnoverRatio:0.3913, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  // ── DIAGNOSTIC (1) ─────────────────────────────────
  { id:"ITM013", name:"Canine Distemper test kit",         unit:"boxes", category:"Diagnostic",         currentStock:6,   averageInventory:8,   avgMonthlyUsage:3,   recencyDays:20, leadTimeDays:12, stockoutFrequency:0, monthlyTurnoverRatio:0.3750, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  // ── DISINFECTANT (1) ───────────────────────────────
  { id:"ITM002", name:"Alcohol",                           unit:"gal",   category:"Disinfectant",       currentStock:26,  averageInventory:30,  avgMonthlyUsage:20,  recencyDays:4,  leadTimeDays:4,  stockoutFrequency:1, monthlyTurnoverRatio:0.6667, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:39  },
  // ── EQUIPMENT (7) ──────────────────────────────────
  { id:"ITM006", name:"Artificial Insemination Gun",       unit:"pc",    category:"Equipment",          currentStock:3,   averageInventory:4,   avgMonthlyUsage:1,   recencyDays:40, leadTimeDays:20, stockoutFrequency:0, monthlyTurnoverRatio:0.2500, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:90  },
  { id:"ITM015", name:"Cautery",                           unit:"pcs",   category:"Equipment",          currentStock:2,   averageInventory:3,   avgMonthlyUsage:1,   recencyDays:45, leadTimeDays:18, stockoutFrequency:0, monthlyTurnoverRatio:0.3333, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  { id:"ITM043", name:"Liquid Nitrogen Tank (Field tank)", unit:"pc",    category:"Equipment",          currentStock:2,   averageInventory:2,   avgMonthlyUsage:1,   recencyDays:60, leadTimeDays:25, stockoutFrequency:0, monthlyTurnoverRatio:0.5000, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  { id:"ITM050", name:"Needle Holder with scissors",       unit:"pcs",   category:"Equipment",          currentStock:3,   averageInventory:4,   avgMonthlyUsage:1,   recencyDays:50, leadTimeDays:18, stockoutFrequency:0, monthlyTurnoverRatio:0.2500, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:90  },
  { id:"ITM062", name:"Scissors (Blunt-Blunt)",            unit:"pcs",   category:"Equipment",          currentStock:2,   averageInventory:3,   avgMonthlyUsage:1,   recencyDays:55, leadTimeDays:18, stockoutFrequency:0, monthlyTurnoverRatio:0.3333, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  { id:"ITM065", name:"Shaver",                            unit:"pcs",   category:"Equipment",          currentStock:2,   averageInventory:3,   avgMonthlyUsage:1,   recencyDays:48, leadTimeDays:16, stockoutFrequency:0, monthlyTurnoverRatio:0.3333, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  { id:"ITM076", name:"Weighing Scale",                    unit:"pc",    category:"Equipment",          currentStock:2,   averageInventory:2,   avgMonthlyUsage:1,   recencyDays:70, leadTimeDays:20, stockoutFrequency:0, monthlyTurnoverRatio:0.5000, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  // ── FEED (3) ───────────────────────────────────────
  { id:"ITM078", name:"Cat Food",                          unit:"bag",   category:"Feed",               currentStock:28,  averageInventory:36,  avgMonthlyUsage:22,  recencyDays:4,  leadTimeDays:6,  stockoutFrequency:0, monthlyTurnoverRatio:0.6111, movementLabel:"Fast", reorderRisk:"OK",     daysUntilStockout:38  },
  { id:"ITM079", name:"Dog Food 20 kgs.",                  unit:"bag",   category:"Feed",               currentStock:34,  averageInventory:42,  avgMonthlyUsage:27,  recencyDays:3,  leadTimeDays:6,  stockoutFrequency:0, monthlyTurnoverRatio:0.6429, movementLabel:"Fast", reorderRisk:"OK",     daysUntilStockout:38  },
  { id:"ITM081", name:"Rice",                              unit:"sack",  category:"Feed",               currentStock:18,  averageInventory:23,  avgMonthlyUsage:11,  recencyDays:8,  leadTimeDays:5,  stockoutFrequency:0, monthlyTurnoverRatio:0.4783, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:49  },
  // ── HORMONAL MEDICINE (2) ──────────────────────────
  { id:"ITM044", name:"Lutalyse",                          unit:"btls",  category:"Hormonal Medicine",  currentStock:10,  averageInventory:13,  avgMonthlyUsage:5,   recencyDays:16, leadTimeDays:10, stockoutFrequency:0, monthlyTurnoverRatio:0.3846, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  { id:"ITM053", name:"Oxytocin 50ml",                     unit:"btls",  category:"Hormonal Medicine",  currentStock:8,   averageInventory:10,  avgMonthlyUsage:3,   recencyDays:18, leadTimeDays:9,  stockoutFrequency:0, monthlyTurnoverRatio:0.3000, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:80  },
  // ── PAIN RELIEF (2) ────────────────────────────────
  { id:"ITM068", name:"Spasmovet",                         unit:"btls",  category:"Pain Relief",        currentStock:11,  averageInventory:15,  avgMonthlyUsage:5,   recencyDays:14, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.3333, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:66  },
  { id:"ITM070", name:"Tolfenamic",                        unit:"btls",  category:"Pain Relief",        currentStock:12,  averageInventory:16,  avgMonthlyUsage:6,   recencyDays:12, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.3750, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  // ── RESPIRATORY MEDICINE (1) ───────────────────────
  { id:"ITM011", name:"Bromhexine Suspension",             unit:"btls",  category:"Respiratory Medicine",currentStock:29, averageInventory:34,  avgMonthlyUsage:16,  recencyDays:8,  leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.4706, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:54  },
  // ── SEDATIVE (1) ───────────────────────────────────
  { id:"ITM012", name:"Calmivet",                          unit:"btls",  category:"Sedative",           currentStock:8,   averageInventory:12,  avgMonthlyUsage:4,   recencyDays:15, leadTimeDays:10, stockoutFrequency:0, monthlyTurnoverRatio:0.3333, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  // ── SHELTER SUPPLY (1) ─────────────────────────────
  { id:"ITM080", name:"Plastic Matting for dogs 1x3 ft",  unit:"pc",    category:"Shelter Supply",     currentStock:8,   averageInventory:10,  avgMonthlyUsage:3,   recencyDays:20, leadTimeDays:9,  stockoutFrequency:0, monthlyTurnoverRatio:0.3000, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:80  },
  // ── SUPPLEMENT (14) ────────────────────────────────
  { id:"ITM008", name:"B-Complex (Hepavita)",              unit:"btls",  category:"Supplement",         currentStock:31,  averageInventory:35,  avgMonthlyUsage:17,  recencyDays:7,  leadTimeDays:6,  stockoutFrequency:0, monthlyTurnoverRatio:0.4857, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:55  },
  { id:"ITM016", name:"CBG Calcionate",                    unit:"btls",  category:"Supplement",         currentStock:9,   averageInventory:11,  avgMonthlyUsage:4,   recencyDays:16, leadTimeDays:9,  stockoutFrequency:0, monthlyTurnoverRatio:0.3636, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:68  },
  { id:"ITM019", name:"Coforta",                           unit:"btls",  category:"Supplement",         currentStock:28,  averageInventory:34,  avgMonthlyUsage:18,  recencyDays:9,  leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.5294, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:47  },
  { id:"ITM030", name:"Electrolytes+Multivitamins+Bcomplex",unit:"btls", category:"Supplement",         currentStock:12,  averageInventory:16,  avgMonthlyUsage:6,   recencyDays:14, leadTimeDays:6,  stockoutFrequency:0, monthlyTurnoverRatio:0.3750, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  { id:"ITM031", name:"Electrolytes with Vitamin C",       unit:"pack",  category:"Supplement",         currentStock:10,  averageInventory:12,  avgMonthlyUsage:5,   recencyDays:16, leadTimeDays:6,  stockoutFrequency:0, monthlyTurnoverRatio:0.4167, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  { id:"ITM032", name:"Ener G Probiotic Powder (5g x14)",  unit:"boxes", category:"Supplement",         currentStock:11,  averageInventory:14,  avgMonthlyUsage:5,   recencyDays:13, leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.3571, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:66  },
  { id:"ITM036", name:"Iron",                              unit:"btls",  category:"Supplement",         currentStock:15,  averageInventory:19,  avgMonthlyUsage:8,   recencyDays:11, leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.4211, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:56  },
  { id:"ITM049", name:"Multivets oral liquid paste 200g",  unit:"pack",  category:"Supplement",         currentStock:13,  averageInventory:17,  avgMonthlyUsage:6,   recencyDays:12, leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.3529, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:65  },
  { id:"ITM054", name:"Papi Bion Plus (Bcomplex with Iron)",unit:"btls", category:"Supplement",         currentStock:11,  averageInventory:14,  avgMonthlyUsage:5,   recencyDays:14, leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.3571, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:66  },
  { id:"ITM055", name:"Papi Livwell",                      unit:"btls",  category:"Supplement",         currentStock:10,  averageInventory:13,  avgMonthlyUsage:4,   recencyDays:16, leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.3077, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:75  },
  { id:"ITM056", name:"Papi MVP (Multivitamins)",          unit:"btls",  category:"Supplement",         currentStock:20,  averageInventory:25,  avgMonthlyUsage:12,  recencyDays:9,  leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.4800, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:50  },
  { id:"ITM061", name:"Renacure",                          unit:"btls",  category:"Supplement",         currentStock:9,   averageInventory:12,  avgMonthlyUsage:4,   recencyDays:16, leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.3333, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:68  },
  { id:"ITM072", name:"Vitamin ADE injectable",            unit:"btls",  category:"Supplement",         currentStock:26,  averageInventory:32,  avgMonthlyUsage:17,  recencyDays:8,  leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.5313, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:46  },
  { id:"ITM075", name:"Water Soluble Vitamin A, D3, E",    unit:"pack",  category:"Supplement",         currentStock:9,   averageInventory:12,  avgMonthlyUsage:4,   recencyDays:17, leadTimeDays:7,  stockoutFrequency:0, monthlyTurnoverRatio:0.3333, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:68  },
  // ── SURGICAL SUPPLY (4) ────────────────────────────
  { id:"ITM009", name:"Blade size #10",                    unit:"boxes", category:"Surgical Supply",    currentStock:18,  averageInventory:22,  avgMonthlyUsage:8,   recencyDays:11, leadTimeDays:6,  stockoutFrequency:0, monthlyTurnoverRatio:0.3636, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:68  },
  { id:"ITM010", name:"Blade size #22",                    unit:"boxes", category:"Surgical Supply",    currentStock:16,  averageInventory:20,  avgMonthlyUsage:7,   recencyDays:13, leadTimeDays:6,  stockoutFrequency:0, monthlyTurnoverRatio:0.3500, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:69  },
  { id:"ITM057", name:"Polyglactin 2",                     unit:"boxes", category:"Surgical Supply",    currentStock:13,  averageInventory:17,  avgMonthlyUsage:6,   recencyDays:13, leadTimeDays:9,  stockoutFrequency:0, monthlyTurnoverRatio:0.3529, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:65  },
  { id:"ITM058", name:"Polyglactin 3",                     unit:"boxes", category:"Surgical Supply",    currentStock:12,  averageInventory:16,  avgMonthlyUsage:6,   recencyDays:14, leadTimeDays:9,  stockoutFrequency:0, monthlyTurnoverRatio:0.3750, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:60  },
  // ── TOPICAL MEDICINE (2) ───────────────────────────
  { id:"ITM014", name:"Canizep ointment",                  unit:"btls",  category:"Topical Medicine",   currentStock:14,  averageInventory:18,  avgMonthlyUsage:6,   recencyDays:12, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.3333, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:70  },
  { id:"ITM051", name:"Otiderm",                           unit:"btls",  category:"Topical Medicine",   currentStock:10,  averageInventory:13,  avgMonthlyUsage:4,   recencyDays:15, leadTimeDays:8,  stockoutFrequency:0, monthlyTurnoverRatio:0.3077, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:75  },
  // ── VACCINE (5) ────────────────────────────────────
  { id:"ITM004", name:"Anti-Rabies vaccine (Rabisin)",     unit:"btls",  category:"Vaccine",            currentStock:520, averageInventory:700, avgMonthlyUsage:180, recencyDays:2,  leadTimeDays:14, stockoutFrequency:2, monthlyTurnoverRatio:0.2571, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:87  },
  { id:"ITM005", name:"Anti Tetanus",                      unit:"boxes", category:"Vaccine",            currentStock:12,  averageInventory:15,  avgMonthlyUsage:5,   recencyDays:18, leadTimeDays:12, stockoutFrequency:0, monthlyTurnoverRatio:0.3333, movementLabel:"Slow", reorderRisk:"OK",     daysUntilStockout:72  },
  { id:"ITM039", name:"Kennel Cough (Vial)",               unit:"btls",  category:"Vaccine",            currentStock:23,  averageInventory:30,  avgMonthlyUsage:14,  recencyDays:7,  leadTimeDays:13, stockoutFrequency:1, monthlyTurnoverRatio:0.4667, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:49  },
  { id:"ITM060", name:"Purified Vero Cell Rabies Vaccine", unit:"btls",  category:"Vaccine",            currentStock:41,  averageInventory:52,  avgMonthlyUsage:27,  recencyDays:3,  leadTimeDays:14, stockoutFrequency:1, monthlyTurnoverRatio:0.5192, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:46  },
  { id:"ITM071", name:"Vanguard 5CVL (Vial)",              unit:"btls",  category:"Vaccine",            currentStock:24,  averageInventory:30,  avgMonthlyUsage:15,  recencyDays:7,  leadTimeDays:13, stockoutFrequency:1, monthlyTurnoverRatio:0.5000, movementLabel:"Fast", reorderRisk:"Review", daysUntilStockout:48  },
];

/* ══════════════════════════════════════════════════════
   RF MOCK CLASSIFIER
   When real RF model is ready: POST /api/inventory/classify
══════════════════════════════════════════════════════ */
function rfClassify(item) {
  const dailyUsage       = item.avgMonthlyUsage / 30;
  const reorderPoint     = Math.ceil(dailyUsage * item.leadTimeDays);
  const daysUntilStockout= item.avgMonthlyUsage > 0
    ? Math.round((item.currentStock / item.avgMonthlyUsage) * 30) : 999;
  const daysToRestock    = Math.max(0, daysUntilStockout - item.leadTimeDays);

  // RF decision (mirrors dataset labels)
  const isFast = (item.monthlyTurnoverRatio >= 0.5 && item.recencyDays <= 7) || item.stockoutFrequency > 0;

  const stockStatus =
    item.currentStock <= reorderPoint * 0.5 ? "Critical" :
    item.currentStock <= reorderPoint        ? "Low"      : "OK";

  const reorderRisk =
    (item.currentStock < item.avgMonthlyUsage || item.stockoutFrequency > 0) ? "Review" : "OK";

  return {
    movement:          isFast ? "Fast" : "Slow",
    reorderPoint,
    daysUntilStockout,
    daysToRestock,
    stockStatus,
    reorderRisk,
  };
}

/* ══════════════════════════════════════════════════════
   LIVE STORE — deep clone + RF applied
══════════════════════════════════════════════════════ */
let store = MOCK_INVENTORY.map(item => ({
  ...item,
  ...rfClassify(item),
  transactions: [],
}));

/* ══════════════════════════════════════════════════════
   STATE
══════════════════════════════════════════════════════ */
let filtered      = [...store];
let currentPage   = 1;
const PAGE_SIZE   = 12;
let activeTab     = "all";
let activeItemId  = null;
let viewMode      = "table";

/* ══════════════════════════════════════════════════════
   CATEGORY COLORS
══════════════════════════════════════════════════════ */
const CAT_COLORS = {
  "Antibiotic":           { bg:"#f3e8ff", color:"#6b21a8" },
  "Antiparasitic":        { bg:"var(--teal-soft)",  color:"var(--teal)"  },
  "Antifungal":           { bg:"#fef3c7", color:"#92400e" },
  "Anesthetic":           { bg:"var(--rose-soft)",  color:"var(--rose)"  },
  "Supplement":           { bg:"var(--green-soft)", color:"var(--green)" },
  "Vaccine":              { bg:"var(--blue-soft)",  color:"var(--blue)"  },
  "Consumable":           { bg:"var(--amber-soft)", color:"var(--amber)" },
  "Surgical Supply":      { bg:"var(--clay-soft)",  color:"var(--clay)"  },
  "Equipment":            { bg:"var(--cream-3)",    color:"var(--stone)" },
  "Disinfectant":         { bg:"var(--teal-soft)",  color:"var(--teal)"  },
  "Topical Medicine":     { bg:"var(--rose-soft)",  color:"var(--rose)"  },
  "Hormonal Medicine":    { bg:"#fef3c7", color:"#92400e" },
  "Respiratory Medicine": { bg:"var(--blue-soft)",  color:"var(--blue)"  },
  "Pain Relief":          { bg:"var(--amber-soft)", color:"var(--amber)" },
  "Sedative":             { bg:"var(--clay-soft)",  color:"var(--clay)"  },
  "Diagnostic":           { bg:"var(--blue-soft)",  color:"var(--blue)"  },
  "Feed":                 { bg:"var(--green-soft)", color:"var(--green)" },
  "Shelter Supply":       { bg:"var(--cream-3)",    color:"var(--stone)" },
};

const catBadge = cat => {
  const c = CAT_COLORS[cat] || { bg:"var(--cream-3)", color:"var(--stone)" };
  return `<span class="cat-badge" style="background:${c.bg};color:${c.color}">${cat}</span>`;
};

const today = () => new Date().toISOString().split("T")[0];
const fmtDate = d => {
  if (!d) return "—";
  return new Date(d+"T00:00:00").toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});
};

/* ── Stats ──────────────────────────────────────────── */
function renderStats() {
  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  const critical = store.filter(i=>i.stockStatus==="Critical").length;
  const low      = store.filter(i=>i.stockStatus==="Low").length;
  const fast     = store.filter(i=>i.movement==="Fast").length;
  const ok       = store.filter(i=>i.stockStatus==="OK").length;
  const review   = store.filter(i=>i.reorderRisk==="Review").length;
  const avgDays  = Math.round(store.filter(i=>i.daysUntilStockout<999).reduce((s,i)=>s+i.daysUntilStockout,0)/Math.max(1,store.filter(i=>i.daysUntilStockout<999).length));
  set("statTotal",    store.length);
  set("statCritical", critical);
  set("statLow",      low);
  set("statFast",     fast);
  set("statOk",       ok);
  set("statAvgDays",  avgDays+"d");
  set("rfFastCount",  fast);
  set("rfReviewCount",review);
}

/* ── Alerts ─────────────────────────────────────────── */
function renderAlerts() {
  const bar      = document.getElementById("alertsBar"); if(!bar) return;
  const critical = store.filter(i=>i.stockStatus==="Critical");
  const fastLow  = store.filter(i=>i.movement==="Fast" && i.reorderRisk==="Review" && i.daysToRestock<=14);
  const slowLow  = store.filter(i=>i.movement==="Slow" && i.currentStock<i.reorderPoint);
  let html = "";

  if (critical.length) {
    const names = critical.slice(0,3).map(i=>i.name.trim()).join(", ")+(critical.length>3?` +${critical.length-3} more`:"");
    html += `<div class="alert-row alert-critical"><i class="bi bi-exclamation-triangle-fill"></i><div><strong>${critical.length} item${critical.length>1?"s":""} at CRITICAL stock level</strong> — Immediate restocking required: ${names}</div><span class="alert-action" data-filter-risk="Review">View all →</span></div>`;
  }
  if (fastLow.length) {
    html += `<div class="alert-row alert-low"><i class="bi bi-cpu"></i><div><strong>RF Alert:</strong> ${fastLow.length} fast-moving item${fastLow.length>1?"s":""} need restocking within <strong>${Math.min(...fastLow.map(i=>i.daysToRestock))}–14 days</strong> based on predicted consumption.</div><span class="alert-action" data-filter-movement="Fast">View fast items →</span></div>`;
  }
  if (!critical.length && !fastLow.length) {
    html += `<div class="alert-row alert-info"><i class="bi bi-check-circle-fill"></i><div>All items are adequately stocked. RF monitoring active — no immediate restock action needed.</div></div>`;
  }
  if (slowLow.length) {
    html += `<div class="alert-row alert-info"><i class="bi bi-info-circle-fill"></i><div><strong>${slowLow.length} slow-moving item${slowLow.length>1?"s":""}</strong> are below reorder point — consider consolidating orders.</div></div>`;
  }

  bar.innerHTML = html;
  bar.querySelectorAll("[data-filter-risk]").forEach(el=>{ el.addEventListener("click",()=>{ document.getElementById("filterRisk").value=el.dataset.filterRisk; applyFilters(); }); });
  bar.querySelectorAll("[data-filter-movement]").forEach(el=>{ el.addEventListener("click",()=>{ document.getElementById("filterMovement").value=el.dataset.filterMovement; applyFilters(); }); });
}

/* ── Filter ─────────────────────────────────────────── */
function applyFilters() {
  const q        = (document.getElementById("searchInventory")?.value||"").toLowerCase().trim();
  const movement = document.getElementById("filterMovement")?.value||"";
  const risk     = document.getElementById("filterRisk")?.value||"";

  filtered = store.filter(item => {
    if (activeTab!=="all" && item.category!==activeTab) return false;
    if (movement && item.movement!==movement)            return false;
    if (risk     && item.reorderRisk!==risk)             return false;
    if (q && !item.name.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q) && !item.category.toLowerCase().includes(q)) return false;
    return true;
  });

  // Critical first → Low → OK → then by days
  const so = {Critical:0,Low:1,OK:2};
  filtered.sort((a,b)=>{ const d=(so[a.stockStatus]||2)-(so[b.stockStatus]||2); return d!==0?d:a.daysUntilStockout-b.daysUntilStockout; });

  currentPage=1; renderView(); renderPagination();
}

/* ── Stock helpers ──────────────────────────────────── */
function stockBar(item) {
  const pct     = Math.min(100,Math.round((item.currentStock/item.averageInventory)*100));
  const fillCls = item.stockStatus==="Critical"?"fill-crit":item.stockStatus==="Low"?"fill-low":"fill-ok";
  const valCls  = item.stockStatus==="Critical"?"days-crit":item.stockStatus==="Low"?"days-warn":"days-ok";
  return `<div class="stock-cell"><span class="stock-val ${valCls}">${item.currentStock} <span style="font-size:0.7rem;font-weight:500;color:var(--stone)">${item.unit}</span></span><div class="stock-bar-wrap"><div class="stock-bar"><div class="stock-bar-fill ${fillCls}" style="width:${pct}%"></div></div><span style="font-size:0.68rem;font-family:var(--mono);color:var(--stone)">${pct}%</span></div></div>`;
}

function daysBadge(item) {
  if (item.daysUntilStockout>=999) return `<span class="days-cell days-ok">—</span>`;
  const cls = item.daysUntilStockout<=14?"days-crit":item.daysUntilStockout<=30?"days-warn":"days-ok";
  return `<span class="days-cell ${cls}">${item.daysUntilStockout}d</span>`;
}

/* ── Table view ─────────────────────────────────────── */
function renderTable() {
  const tbody=document.getElementById("inventoryTableBody"); if(!tbody)return;
  const start=(currentPage-1)*PAGE_SIZE, page=filtered.slice(start,start+PAGE_SIZE);
  if(!page.length){ tbody.innerHTML=`<tr><td colspan="9" class="text-center py-5 text-muted">No items found.</td></tr>`; return; }
  tbody.innerHTML=page.map(item=>`
    <tr data-id="${item.id}" class="${item.id===activeItemId?"row-active":""}">
      <td><div class="item-name-cell"><div class="item-name">${item.name.trim()}</div><div class="item-id">${item.id}</div></div></td>
      <td>${catBadge(item.category)}</td>
      <td style="font-size:0.82rem;color:var(--stone)">${item.unit}</td>
      <td>${stockBar(item)}</td>
      <td style="font-family:var(--mono);font-size:0.82rem;color:var(--stone)">${item.avgMonthlyUsage}/${item.unit}</td>
      <td>${daysBadge(item)}</td>
      <td><span class="movement-badge movement-${item.movement.toLowerCase()}"><i class="bi ${item.movement==="Fast"?"bi-lightning-charge-fill":"bi-hourglass"}"></i>${item.movement}</span></td>
      <td><span class="${item.reorderRisk==="Review"?"risk-review":"risk-ok"}"><i class="bi ${item.reorderRisk==="Review"?"bi-exclamation-circle-fill":"bi-check-circle-fill"}"></i> ${item.reorderRisk}</span></td>
      <td>
        <button class="tbl-action-btn" title="View" data-action="view" data-id="${item.id}"><i class="bi bi-eye"></i></button>
        <button class="tbl-action-btn stock-in" title="Stock In" data-action="stockin" data-id="${item.id}"><i class="bi bi-plus-lg"></i></button>
        <button class="tbl-action-btn use" title="Record Usage" data-action="use" data-id="${item.id}"><i class="bi bi-dash-lg"></i></button>
      </td>
    </tr>`).join("");

  tbody.querySelectorAll("tr[data-id]").forEach(row=>{
    row.addEventListener("click",e=>{ if(e.target.closest("[data-action]"))return; openDrawer(row.dataset.id); });
  });
  tbody.querySelectorAll("[data-action]").forEach(btn=>{
    btn.addEventListener("click",e=>{ e.stopPropagation(); const{action,id}=btn.dataset; if(action==="view")openDrawer(id); if(action==="stockin")openStockIn(id); if(action==="use")openStockOut(id); });
  });
}

/* ── Card view ──────────────────────────────────────── */
function renderCards() {
  const grid=document.getElementById("inventoryCardGrid"); if(!grid)return;
  const start=(currentPage-1)*PAGE_SIZE, page=filtered.slice(start,start+PAGE_SIZE);
  if(!page.length){ grid.innerHTML=`<div class="text-center text-muted py-5" style="grid-column:1/-1">No items found.</div>`; return; }
  grid.innerHTML=page.map(item=>{
    const bc   =item.stockStatus==="Critical"?"card-crit":item.stockStatus==="Low"?"card-low":"";
    const pct  =Math.min(100,Math.round((item.currentStock/item.averageInventory)*100));
    const fc   =item.stockStatus==="Critical"?"fill-crit":item.stockStatus==="Low"?"fill-low":"fill-ok";
    return `<div class="inv-card ${bc} ${item.id===activeItemId?"card-active":""}" data-id="${item.id}">
      <div class="inv-card-header">
        <div><div class="inv-card-name">${item.name.trim()}</div><div class="inv-card-id">${item.id}</div></div>
        ${catBadge(item.category)}
      </div>
      <div class="inv-card-stock">${item.currentStock}</div>
      <div class="inv-card-unit">${item.unit} in stock</div>
      <div style="margin:8px 0 4px"><div class="stock-bar" style="height:5px"><div class="stock-bar-fill ${fc}" style="width:${pct}%"></div></div></div>
      <div class="inv-card-meta">
        <span class="movement-badge movement-${item.movement.toLowerCase()}" style="font-size:0.65rem;padding:2px 7px"><i class="bi ${item.movement==="Fast"?"bi-lightning-charge-fill":"bi-hourglass"}"></i>${item.movement}</span>
        ${daysBadge(item)}
      </div>
      <div class="inv-card-footer">
        <button class="inv-card-btn" data-action="stockin" data-id="${item.id}"><i class="bi bi-plus-lg"></i> Stock In</button>
        <button class="inv-card-btn card-use" data-action="use" data-id="${item.id}"><i class="bi bi-dash-lg"></i> Use</button>
      </div>
    </div>`;
  }).join("");

  grid.querySelectorAll(".inv-card").forEach(card=>{
    card.addEventListener("click",e=>{ if(e.target.closest("[data-action]"))return; openDrawer(card.dataset.id); });
  });
  grid.querySelectorAll("[data-action]").forEach(btn=>{
    btn.addEventListener("click",e=>{ e.stopPropagation(); if(btn.dataset.action==="stockin")openStockIn(btn.dataset.id); if(btn.dataset.action==="use")openStockOut(btn.dataset.id); });
  });
}

function renderView() { viewMode==="table"?renderTable():renderCards(); }

/* ── Pagination ─────────────────────────────────────── */
function renderPagination() {
  const bar=document.getElementById("paginationBar"); if(!bar)return;
  const total=filtered.length, pages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const start=Math.min((currentPage-1)*PAGE_SIZE+1,total), end=Math.min(currentPage*PAGE_SIZE,total);
  let h=`<span class="page-info">Showing ${total?start:0}–${end} of ${total}</span>`;
  h+=`<button class="page-btn" id="pagePrev" ${currentPage===1?"disabled":""}><i class="bi bi-chevron-left"></i></button>`;
  for(let i=1;i<=Math.min(pages,8);i++) h+=`<button class="page-btn ${i===currentPage?"active":""}" data-page="${i}">${i}</button>`;
  if(pages>8) h+=`<span style="color:var(--stone);font-size:0.82rem;padding:0 4px">…${pages}</span>`;
  h+=`<button class="page-btn" id="pageNext" ${currentPage===pages?"disabled":""}><i class="bi bi-chevron-right"></i></button>`;
  bar.innerHTML=h;
  bar.querySelector("#pagePrev")?.addEventListener("click",()=>{if(currentPage>1){currentPage--;renderView();renderPagination();}});
  bar.querySelector("#pageNext")?.addEventListener("click",()=>{if(currentPage<pages){currentPage++;renderView();renderPagination();}});
  bar.querySelectorAll("[data-page]").forEach(b=>b.addEventListener("click",()=>{currentPage=parseInt(b.dataset.page);renderView();renderPagination();}));
}

/* ── Drawer ─────────────────────────────────────────── */
function openDrawer(id) {
  const item=store.find(i=>i.id===id); if(!item)return;
  activeItemId=id;
  document.querySelectorAll("tr[data-id]").forEach(r=>r.classList.toggle("row-active",r.dataset.id===id));
  document.querySelectorAll(".inv-card").forEach(c=>c.classList.toggle("card-active",c.dataset.id===id));
  document.getElementById("invLayout")?.classList.add("drawer-open");
  renderDrawer(item);
}

function closeDrawer() {
  activeItemId=null;
  document.getElementById("invLayout")?.classList.remove("drawer-open");
  document.querySelectorAll("tr[data-id]").forEach(r=>r.classList.remove("row-active"));
  document.querySelectorAll(".inv-card").forEach(c=>c.classList.remove("card-active"));
}

function renderDrawer(item) {
  const inner=document.getElementById("invDrawerInner"); if(!inner)return;
  const daysColor=item.daysUntilStockout<=14?"fill-days-crit":item.daysUntilStockout<=30?"fill-days-warn":"fill-days-ok";
  const daysPct  =item.daysUntilStockout>=999?100:Math.min(100,Math.round(item.daysUntilStockout/90*100));
  const txns     =item.transactions.slice().reverse().slice(0,8);

  inner.innerHTML=`
    <div class="drawer-header">
      <div><h3>${item.name.trim()}</h3><p>${item.id} · ${item.category} · ${item.unit}</p></div>
      <button class="drawer-close-btn" id="drawerCloseX"><i class="bi bi-x-lg"></i></button>
    </div>
    <div class="drawer-body">

      <div class="drawer-section">
        <div class="drawer-section-title"><i class="bi bi-boxes"></i> Stock Status</div>
        <div class="drawer-info-grid">
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Current Stock</div>
            <div class="drawer-info-val" style="font-size:1.3rem;font-weight:800;color:${item.stockStatus==="Critical"?"var(--clay)":item.stockStatus==="Low"?"var(--amber)":"var(--ink)"}">${item.currentStock} <span style="font-size:0.8rem;font-weight:500;color:var(--stone)">${item.unit}</span></div>
          </div>
          <div class="drawer-info-item">
            <div class="drawer-info-lbl">Status</div>
            <div class="drawer-info-val">
              <span class="${item.stockStatus==="Critical"||item.stockStatus==="Low"?"risk-review":"risk-ok"}" style="${item.stockStatus==="Low"?"background:var(--amber-soft);color:var(--amber)":""}">
                ${item.stockStatus==="Critical"?"⚠ Critical":item.stockStatus==="Low"?"↓ Low":"✓ OK"}
              </span>
            </div>
          </div>
          <div class="drawer-info-item"><div class="drawer-info-lbl">Avg Monthly Usage</div><div class="drawer-info-val">${item.avgMonthlyUsage} ${item.unit}/mo</div></div>
          <div class="drawer-info-item"><div class="drawer-info-lbl">Average Inventory</div><div class="drawer-info-val">${item.averageInventory} ${item.unit}</div></div>
          <div class="drawer-info-item"><div class="drawer-info-lbl">Reorder Point</div><div class="drawer-info-val">${item.reorderPoint} ${item.unit}</div></div>
          <div class="drawer-info-item"><div class="drawer-info-lbl">Lead Time</div><div class="drawer-info-val">${item.leadTimeDays} days</div></div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title"><i class="bi bi-diagram-3-fill"></i> Random Forest Prediction (Mock)</div>
        <div class="rf-pred-card">
          <div class="rf-pred-header">
            <span class="rf-chip"><i class="bi bi-cpu-fill"></i> RF Classified</span>
            <span class="movement-badge movement-${item.movement.toLowerCase()}">
              <i class="bi ${item.movement==="Fast"?"bi-lightning-charge-fill":"bi-hourglass"}"></i> ${item.movement}-Moving
            </span>
          </div>
          <div class="rf-pred-metrics">
            <div class="rf-metric"><div class="rf-metric-val">${item.daysUntilStockout>=999?"—":item.daysUntilStockout+"d"}</div><div class="rf-metric-lbl">Est. Days Until Stockout</div></div>
            <div class="rf-metric"><div class="rf-metric-val">${item.daysToRestock<=0?"Now":item.daysToRestock+"d"}</div><div class="rf-metric-lbl">Restock Action In</div></div>
            <div class="rf-metric"><div class="rf-metric-val">${(item.monthlyTurnoverRatio*100).toFixed(0)}%</div><div class="rf-metric-lbl">Monthly Turnover Rate</div></div>
            <div class="rf-metric"><div class="rf-metric-val">${item.stockoutFrequency}×</div><div class="rf-metric-lbl">Stockout Frequency</div></div>
          </div>
          ${item.daysUntilStockout<999?`
          <div class="stockout-meter" style="margin-top:12px">
            <div class="stockout-meter-lbl"><span>Stock runway</span><span>${item.daysUntilStockout} days remaining</span></div>
            <div class="stockout-meter-track"><div class="stockout-meter-fill ${daysColor}" style="width:${daysPct}%"></div></div>
          </div>`:""}
          <div style="margin-top:10px;font-size:0.75rem;color:var(--teal);display:flex;align-items:center;gap:5px">
            <i class="bi bi-info-circle"></i>
            <span>${item.reorderRisk==="Review"?`⚠ Restock recommended${item.daysToRestock<=0?" now":" within "+item.daysToRestock+" days"} — allow ${item.leadTimeDays}d lead time`:"✓ Stock is adequate. No action needed yet."}</span>
          </div>
        </div>
      </div>

      <div class="drawer-section">
        <div class="drawer-section-title"><i class="bi bi-clock-history"></i> Transaction History (${item.transactions.length})</div>
        ${txns.length?`<div class="txn-list">${txns.map(t=>`
          <div class="txn-item">
            <div class="txn-icon ${t.type==="in"?"txn-in":"txn-out"}"><i class="bi ${t.type==="in"?"bi-plus-lg":"bi-dash-lg"}"></i></div>
            <div class="txn-body">
              <div class="txn-type">${t.type==="in"?"Stock In":"Used — "+t.procedure}</div>
              <div class="txn-meta">${fmtDate(t.date)}${t.animal?" · "+t.animal:""}${t.supplier?" · "+t.supplier:""}${t.staff?" · by "+t.staff:""}</div>
              ${t.notes?`<div class="txn-meta" style="font-style:italic">${t.notes}</div>`:""}
            </div>
            <span class="txn-qty ${t.type==="in"?"qty-in":"qty-out"}">${t.type==="in"?"+":"-"}${t.qty}</span>
          </div>`).join("")}</div>`:`<p style="font-size:0.84rem;color:var(--stone);text-align:center;padding:16px 0">No transactions recorded yet.</p>`}
      </div>

    </div>
    <div class="drawer-footer">
      <button class="btn-ghost-clay" id="drawerCloseBtn"><i class="bi bi-x"></i> Close</button>
      <button class="btn-outline-add" id="drawerEditBtn"><i class="bi bi-pencil"></i> Edit</button>
      <button class="btn-primary-clay" style="background:var(--amber);flex:1" id="drawerUseBtn"><i class="bi bi-dash-lg"></i> Record Usage</button>
      <button class="btn-primary-clay" style="flex:1" id="drawerStockInBtn"><i class="bi bi-plus-lg"></i> Stock In</button>
    </div>`;

  document.getElementById("drawerCloseX")?.addEventListener("click",    closeDrawer);
  document.getElementById("drawerCloseBtn")?.addEventListener("click",  closeDrawer);
  document.getElementById("drawerStockInBtn")?.addEventListener("click",()=>openStockIn(item.id));
  document.getElementById("drawerUseBtn")?.addEventListener("click",    ()=>openStockOut(item.id));
  document.getElementById("drawerEditBtn")?.addEventListener("click",   ()=>openItemModal(item.id));
}

/* ── Real-time deduction (called by medical records page) ── */
function deductStock(itemId, qty, opts={}) {
  const item=store.find(i=>i.id===itemId); if(!item)return null;
  if(item.currentStock<qty) return {error:"Insufficient stock"};
  item.currentStock-=qty;
  item.transactions.push({ type:"out",qty, date:opts.date||today(), animal:opts.animal||"", procedure:opts.procedure||"General Use", notes:opts.notes||"", staff:opts.staff||getUserName()?.split(" ")[0]||"Staff" });
  Object.assign(item, rfClassify(item));
  return item;
}

function addStock(itemId, qty, opts={}) {
  const item=store.find(i=>i.id===itemId); if(!item)return null;
  item.currentStock+=qty;
  item.transactions.push({ type:"in",qty, date:opts.date||today(), supplier:opts.supplier||"", notes:opts.notes||"", staff:getUserName()?.split(" ")[0]||"Staff" });
  Object.assign(item, rfClassify(item));
  return item;
}

// Cross-page event: medical records fire this when an item is used on an animal
window.addEventListener("animua:stockDeduct", e=>{
  const{itemId,qty,animal,procedure,notes}=e.detail;
  const result=deductStock(itemId,qty,{animal,procedure,notes});
  if(result?.error) console.warn("[stockDeduct]",result.error);
  else{ renderStats();renderAlerts();renderView(); if(activeItemId===itemId)renderDrawer(store.find(i=>i.id===itemId)); }
});

/* ── Stock In Modal ─────────────────────────────────── */
function openStockIn(prefillId=null) {
  const select=document.getElementById("fStockItemSelect");
  select.innerHTML=store.map(i=>`<option value="${i.id}">${i.name.trim()} (${i.id}) — ${i.currentStock} ${i.unit}</option>`).join("");
  if(prefillId) select.value=prefillId;
  document.getElementById("fStockDate").value="";
  document.getElementById("fStockQty").value="";
  document.getElementById("fStockSupplier").value="";
  document.getElementById("fStockNotes").value="";
  document.getElementById("errStockItem").textContent="";
  document.getElementById("errStockQty").textContent="";
  document.getElementById("stockInTitle").textContent=prefillId?`Stock In — ${store.find(i=>i.id===prefillId)?.name.trim()}`:"Stock In";
  document.getElementById("fStockDate").value=today();
  openModal("stockInModalBackdrop");
}

function saveStockIn() {
  const id=document.getElementById("fStockItemSelect").value;
  const qty=parseInt(document.getElementById("fStockQty").value);
  if(!id){document.getElementById("errStockItem").textContent="Please select an item.";return;}
  if(!qty||qty<1){document.getElementById("errStockQty").textContent="Enter a valid quantity.";return;}
  const result=addStock(id,qty,{date:document.getElementById("fStockDate").value,supplier:document.getElementById("fStockSupplier").value.trim(),notes:document.getElementById("fStockNotes").value.trim()});
  closeModal("stockInModalBackdrop");
  renderStats();renderAlerts();renderView();
  if(activeItemId===id) renderDrawer(result);
  showToast("success",`+${qty} ${result.unit} added to ${result.name.trim()}.`);
}

/* ── Stock Out Modal ────────────────────────────────── */
function openStockOut(id) {
  const item=store.find(i=>i.id===id); if(!item)return;
  document.getElementById("fOutItemId").value=id;
  document.getElementById("fOutItemName").textContent=`${item.name.trim()} — ${item.currentStock} ${item.unit} available`;
  document.getElementById("fOutQty").value="";
  document.getElementById("fOutDate").value=today();
  document.getElementById("fOutAnimal").value="";
  document.getElementById("fOutProcedure").value="";
  document.getElementById("fOutNotes").value="";
  document.getElementById("errOutQty").textContent="";
  document.getElementById("stockOutSubtitle").textContent=`Deduct from: ${item.name.trim()} (${item.currentStock} ${item.unit} available)`;
  openModal("stockOutModalBackdrop");
}

function saveStockOut() {
  const id=document.getElementById("fOutItemId").value;
  const qty=parseInt(document.getElementById("fOutQty").value);
  const item=store.find(i=>i.id===id);
  if(!qty||qty<1){document.getElementById("errOutQty").textContent="Enter a valid quantity.";return;}
  if(qty>item.currentStock){document.getElementById("errOutQty").textContent=`Only ${item.currentStock} ${item.unit} available.`;return;}
  const result=deductStock(id,qty,{date:document.getElementById("fOutDate").value,animal:document.getElementById("fOutAnimal").value.trim(),procedure:document.getElementById("fOutProcedure").value,notes:document.getElementById("fOutNotes").value.trim()});
  closeModal("stockOutModalBackdrop");
  renderStats();renderAlerts();renderView();
  if(activeItemId===id) renderDrawer(result);
  if(result.stockStatus==="Critical") showToast("error",`⚠ ${result.name.trim()} is now at CRITICAL stock level (${result.currentStock} ${result.unit}).`);
  else if(result.stockStatus==="Low") showToast("warning",`↓ ${result.name.trim()} stock is LOW (${result.currentStock} ${result.unit}).`);
  else showToast("success",`−${qty} ${result.unit} deducted from ${result.name.trim()}.`);
}

/* ── Add/Edit Item Modal ────────────────────────────── */
let editingItemId=null;
function openItemModal(id=null) {
  editingItemId=id;
  const item=id?store.find(i=>i.id===id):null;
  document.getElementById("itemModalTitle").textContent=id?"Edit Item":"Add New Item";
  document.getElementById("fItemId").value=id||"";
  document.getElementById("fItemName").value=item?.name.trim()||"";
  document.getElementById("fItemCategory").value=item?.category||"";
  document.getElementById("fItemUnit").value=item?.unit||"";
  document.getElementById("fItemCurrentStock").value=item?.currentStock||"";
  document.getElementById("fItemAvgUsage").value=item?.avgMonthlyUsage||"";
  document.getElementById("fItemLeadTime").value=item?.leadTimeDays||"";
  ["errItemName","errItemCategory","errItemStock"].forEach(id=>{document.getElementById(id).textContent="";});
  openModal("itemModalBackdrop");
}

function saveItem() {
  const name=document.getElementById("fItemName").value.trim();
  const cat=document.getElementById("fItemCategory").value;
  const stock=parseInt(document.getElementById("fItemCurrentStock").value);
  if(!name){document.getElementById("errItemName").textContent="Name is required.";return;}
  if(!cat){document.getElementById("errItemCategory").textContent="Category is required.";return;}
  if(isNaN(stock)||stock<0){document.getElementById("errItemStock").textContent="Valid stock required.";return;}

  if(editingItemId){
    const item=store.find(i=>i.id===editingItemId);
    if(item){
      item.name=name; item.category=cat;
      item.unit=document.getElementById("fItemUnit").value.trim()||item.unit;
      item.currentStock=stock;
      item.avgMonthlyUsage=parseInt(document.getElementById("fItemAvgUsage").value)||item.avgMonthlyUsage;
      item.leadTimeDays=parseInt(document.getElementById("fItemLeadTime").value)||item.leadTimeDays;
      Object.assign(item,rfClassify(item));
    }
    showToast("success","Item updated.");
  } else {
    const newId=`ITM${String(store.length+1).padStart(3,"0")}X`;
    const newItem={id:newId,name,category:cat,unit:document.getElementById("fItemUnit").value.trim()||"pcs",currentStock:stock,averageInventory:stock,avgMonthlyUsage:parseInt(document.getElementById("fItemAvgUsage").value)||1,leadTimeDays:parseInt(document.getElementById("fItemLeadTime").value)||7,stockoutFrequency:0,monthlyTurnoverRatio:0,recencyDays:0,transactions:[]};
    Object.assign(newItem,rfClassify(newItem));
    store.push(newItem);
    // Rebuild category tabs to include new category if needed
    buildCategoryTabs();
    showToast("success","New item added.");
  }
  closeModal("itemModalBackdrop");
  renderStats();renderAlerts();applyFilters();
}

/* ── Category tabs ──────────────────────────────────── */
function buildCategoryTabs() {
  const cats=["all",...new Set(store.map(i=>i.category).sort())];
  const container=document.getElementById("categoryTabs"); if(!container)return;
  const labels={
    "all":"All","Antibiotic":"Antibiotic","Antiparasitic":"Antiparasitic","Antifungal":"Antifungal",
    "Anesthetic":"Anesthetic","Supplement":"Supplement","Vaccine":"Vaccine","Consumable":"Consumable",
    "Surgical Supply":"Surgical","Equipment":"Equipment","Disinfectant":"Disinfectant",
    "Topical Medicine":"Topical","Hormonal Medicine":"Hormonal","Respiratory Medicine":"Respiratory",
    "Pain Relief":"Pain Relief","Sedative":"Sedative","Diagnostic":"Diagnostic","Feed":"Feed","Shelter Supply":"Shelter",
  };
  container.innerHTML=cats.map(c=>`<button class="inv-tab ${c===activeTab?"active":""}" data-tab="${c}">${labels[c]||c}</button>`).join("");
  container.querySelectorAll(".inv-tab").forEach(btn=>{
    btn.addEventListener("click",()=>{
      container.querySelectorAll(".inv-tab").forEach(t=>t.classList.remove("active"));
      btn.classList.add("active"); activeTab=btn.dataset.tab; applyFilters();
    });
  });
}

/* ── Modals / Toast / Sidebar ───────────────────────── */
const openModal  = id=>document.getElementById(id)?.classList.add("open");
const closeModal = id=>document.getElementById(id)?.classList.remove("open");
const closeAllModals=()=>["stockInModalBackdrop","stockOutModalBackdrop","itemModalBackdrop"].forEach(closeModal);

let toastT;
function showToast(type,msg){
  const t=document.getElementById("umToast"),i=document.getElementById("toastIcon"),m=document.getElementById("toastMsg"); if(!t)return;
  const icons={success:"bi-check-circle-fill",error:"bi-x-circle-fill",info:"bi-info-circle-fill",warning:"bi-exclamation-triangle-fill"};
  t.className=`um-toast toast-${type}`; i.className=`bi ${icons[type]||"bi-info-circle-fill"}`; m.textContent=msg;
  t.classList.add("show"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("show"),4000);
}

function bindSidebarToggle(){
  document.getElementById("sidebarToggle")?.addEventListener("click",()=>{
    const sb=document.getElementById("sidebar"),ct=document.getElementById("sidebar-container");
    if(window.innerWidth<=768){document.getElementById("mobile-nav-toggle")?.click();return;}
    const c=sb?.classList.toggle("collapsed"); if(ct){ct.style.width=c?"64px":"";ct.style.minWidth=c?"64px":"";}
  });
}

/* ── Init ───────────────────────────────────────────── */
async function init(){
  try{
    await protectManagementPage();
    loadSidebar(); renderTopbarUser(); bindSidebarToggle();
    buildCategoryTabs();
    renderStats();
    renderAlerts();
    applyFilters();

    document.getElementById("searchInventory")?.addEventListener("input",  applyFilters);
    document.getElementById("filterMovement")?.addEventListener("change",  applyFilters);
    document.getElementById("filterRisk")?.addEventListener("change",      applyFilters);

    document.getElementById("alertViewFast")?.addEventListener("click",()=>{ document.getElementById("filterMovement").value="Fast"; applyFilters(); });

    // View toggle
    document.getElementById("btnTableView")?.addEventListener("click",()=>{
      viewMode="table";
      document.getElementById("tableView").style.display="";
      document.getElementById("cardView").style.display="none";
      document.getElementById("btnTableView").classList.add("active");
      document.getElementById("btnCardView").classList.remove("active");
      renderTable(); renderPagination();
    });
    document.getElementById("btnCardView")?.addEventListener("click",()=>{
      viewMode="card";
      document.getElementById("tableView").style.display="none";
      document.getElementById("cardView").style.display="";
      document.getElementById("btnCardView").classList.add("active");
      document.getElementById("btnTableView").classList.remove("active");
      renderCards(); renderPagination();
    });

    document.getElementById("btnStockIn")?.addEventListener("click", ()=>openStockIn());
    document.getElementById("btnAddItem")?.addEventListener("click", ()=>openItemModal());

    document.getElementById("stockInClose")?.addEventListener("click",  ()=>closeModal("stockInModalBackdrop"));
    document.getElementById("stockInCancel")?.addEventListener("click", ()=>closeModal("stockInModalBackdrop"));
    document.getElementById("stockInSave")?.addEventListener("click",   saveStockIn);

    document.getElementById("stockOutClose")?.addEventListener("click",  ()=>closeModal("stockOutModalBackdrop"));
    document.getElementById("stockOutCancel")?.addEventListener("click", ()=>closeModal("stockOutModalBackdrop"));
    document.getElementById("stockOutSave")?.addEventListener("click",   saveStockOut);

    document.getElementById("itemModalClose")?.addEventListener("click",  ()=>closeModal("itemModalBackdrop"));
    document.getElementById("itemModalCancel")?.addEventListener("click", ()=>closeModal("itemModalBackdrop"));
    document.getElementById("itemModalSave")?.addEventListener("click",   saveItem);

    ["stockInModalBackdrop","stockOutModalBackdrop","itemModalBackdrop"].forEach(id=>{
      document.getElementById(id)?.addEventListener("click",e=>{ if(e.target.id===id)closeModal(id); });
    });
    document.addEventListener("keydown",e=>{ if(e.key==="Escape")closeAllModals(); });

    document.body.classList.remove("loading");
  } catch(err){
    console.error("Inventory init failed:",err);
    document.body.classList.remove("loading");
  }
}

window.addEventListener("DOMContentLoaded",init);