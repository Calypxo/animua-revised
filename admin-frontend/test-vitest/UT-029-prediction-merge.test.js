import { describe, it, expect } from "vitest";
import { mergeInventoryPredictions, markInventoryPredictionsUnavailable } from "../src/management/inventoryPredictionMerge.js";

const inventory=[{id:"A",currentStock:11},{id:"B",currentStock:4}];
describe("UT-029 — Prediction Merge",()=>{
  it("Scenario 1 — preserves live stock when predictions are unavailable",()=>{const result=markInventoryPredictionsUnavailable(inventory,"API offline");expect(result.map(x=>x.currentStock)).toEqual([11,4]);expect(result.every(x=>!x.predictionAvailable)).toBe(true);});
  it("Scenario 2 — merges reverse-order predictions by stable item ID",()=>{const result=mergeInventoryPredictions(inventory,{items:[{itemId:"B",predictionAvailable:true,predictedMovement:"Fast"},{itemId:"A",predictionAvailable:true,predictedMovement:"Slow"}]});expect(result.map(x=>[x.id,x.predictedMovement])).toEqual([["A","Slow"],["B","Fast"]]);});
  it("Scenario 3 — does not lend B's prediction to A",()=>{const result=mergeInventoryPredictions(inventory,{items:[{itemId:"B",predictionAvailable:true,predictedMovement:"Fast"}]});expect(result[0]).toMatchObject({predictedMovement:null,predictionStatus:"unavailable"});expect(result[1].predictedMovement).toBe("Fast");});
  it("Scenario 4 — marks only the corresponding unavailable result as missing-data",()=>{const result=mergeInventoryPredictions(inventory,{items:[{itemId:"A",predictionAvailable:false,message:"Average Inventory is missing",missingFeatures:["Average Inventory"]},{itemId:"B",predictionAvailable:true,predictedMovement:"Slow"}]});expect(result[0]).toMatchObject({predictionStatus:"missing-data",missingPredictionFeatures:["Average Inventory"]});expect(result[1]).toMatchObject({predictionStatus:"ready",predictionAvailable:true});});
});
