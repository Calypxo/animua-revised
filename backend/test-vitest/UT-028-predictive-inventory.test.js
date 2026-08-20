const utils = require("../src/utils/predictiveUtils");
const service = require("../src/services/predictiveService");

const liveItem=(extra={})=>({id:"INV-001",name:"Test item",category:"Consumable",unit:"pcs",currentStock:20,averageInventory:40,avgMonthlyUsage:10,recencyDays:4,leadTimeDays:7,stockoutFrequency:1,monthlyTurnoverRatio:.25,...extra});
const classifier={predict:rows=>rows.map(()=>"Slow")};

describe("UT-028 — Predictive Inventory Utilities and Service",()=>{
  it("Scenario 1 — returns the exact controlled Slow prediction and stockout metrics",()=>{const result=service.predictLiveInventoryItems([liveItem()],{classifier,trainedTrees:[{}]}).items[0];expect(result).toMatchObject({actualCurrentStock:20,predictedMovement:"Slow",predictionAvailable:true,stockoutRiskPercent:8,daysToStockout:60,isAlert:false});});
  it("Scenario 2 — derives a 0.25 monthly turnover ratio",()=>{const input=utils.buildPredictionInputFromLiveItem(liveItem({monthlyTurnoverRatio:undefined}));expect(input.row["Monthly Turnover Ratio"]).toBe(.25);expect(input.derivedFeatures).toEqual(["Monthly Turnover Ratio"]);});
  it("Scenario 3 — reports invalid Current Stock as per-item unavailable",()=>{const item=service.predictLiveInventoryItems([liveItem({currentStock:"not-a-number"})],{classifier,trainedTrees:[{}]}).items[0];expect(item).toMatchObject({predictionAvailable:false,missingFeatures:["Current Stock"]});});
  it("Scenario 4 — throws the coded untrained-model error",()=>expect(()=>service.predictLiveInventoryItems([liveItem()],{classifier:null,trainedTrees:null})).toThrow(expect.objectContaining({code:"MODEL_NOT_TRAINED"})));
  it("Scenario 5 — records failure for empty rows and workbook-reader errors",async()=>{await expect(service.trainInventoryModel({readRows:()=>[]})).rejects.toThrow(/No valid training rows/);expect(service.getModelStatus().summary.trained).toBe(false);await expect(service.trainInventoryModel({readRows:()=>{throw new Error("corrupt workbook");}})).rejects.toThrow(/corrupt workbook/);expect(service.getModelStatus()).toMatchObject({modelLoaded:false,summary:{trained:false,error:"corrupt workbook"}});});
});
