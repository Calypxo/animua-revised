const fs = require("fs");
const path = require("path");
const { RandomForestClassifier } = require("random-forest-classifier");
const {
  FEATURE_COLUMNS,
  TARGET_COLUMN,
  prepareTrainingRows,
  readExcelRows,
} = require("../src/utils/predictiveUtils");
const { predictMovement } = require("../src/services/predictiveService");

const DEFAULT_DATA_FILE = path.join(__dirname, "../data/Inventory.xlsx");
const SUPPORTED_LABELS = ["Fast", "Slow"];

function createSeededRandom(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function classCounts(rows) {
  return Object.fromEntries(
    SUPPORTED_LABELS.map((label) => [
      label,
      rows.filter((row) => row[TARGET_COLUMN] === label).length,
    ]),
  );
}

function buildStratifiedFolds(rows, foldCount = 5, seed = 42) {
  if (!Number.isInteger(foldCount) || foldCount < 2) {
    throw new Error("foldCount must be an integer of at least 2.");
  }

  const random = createSeededRandom(seed);
  const folds = Array.from({ length: foldCount }, () => []);

  for (const label of SUPPORTED_LABELS) {
    const classRows = rows.filter((row) => row[TARGET_COLUMN] === label);
    if (classRows.length < foldCount) {
      throw new Error(
        `${label} has ${classRows.length} rows, fewer than ${foldCount} folds.`,
      );
    }
    shuffle(classRows, random).forEach((row, index) => {
      folds[index % foldCount].push(row);
    });
  }

  return folds.map((fold) => shuffle(fold, random));
}

function fitClassifier(trainingRows, classifier, seed) {
  const originalRandom = Math.random;
  Math.random = createSeededRandom(seed);

  return new Promise((resolve, reject) => {
    const restoreAndResolve = (error, trees) => {
      Math.random = originalRandom;
      if (error) reject(error);
      else resolve(trees);
    };

    try {
      classifier.fit(
        trainingRows,
        FEATURE_COLUMNS,
        TARGET_COLUMN,
        restoreAndResolve,
      );
    } catch (error) {
      Math.random = originalRandom;
      reject(error);
    }
  });
}

function predictionRow(row) {
  return Object.fromEntries(
    FEATURE_COLUMNS.map((feature) => [feature, row[feature]]),
  );
}

function safeDivide(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function round(value, digits = 6) {
  return Number(Number(value).toFixed(digits));
}

function calculateMetrics(predictions) {
  if (!predictions.length) {
    throw new Error("At least one prediction is required.");
  }

  const confusion = Object.fromEntries(
    SUPPORTED_LABELS.map((actual) => [
      actual,
      { Fast: 0, Slow: 0, Unavailable: 0 },
    ]),
  );
  let correct = 0;
  let available = 0;

  for (const item of predictions) {
    if (!SUPPORTED_LABELS.includes(item.actual)) {
      throw new Error(`Unsupported actual label: ${item.actual}`);
    }
    const predicted = SUPPORTED_LABELS.includes(item.predicted)
      ? item.predicted
      : "Unavailable";
    confusion[item.actual][predicted] += 1;
    if (predicted !== "Unavailable") available += 1;
    if (predicted === item.actual) correct += 1;
  }

  const perClass = {};
  for (const label of SUPPORTED_LABELS) {
    const other = SUPPORTED_LABELS.find((value) => value !== label);
    const truePositive = confusion[label][label];
    const falseNegative = confusion[label][other] + confusion[label].Unavailable;
    const falsePositive = confusion[other][label];
    const support = truePositive + falseNegative;
    const predictedCount = truePositive + falsePositive;
    const precision = safeDivide(truePositive, predictedCount);
    const recall = safeDivide(truePositive, support);
    const f1 = safeDivide(2 * precision * recall, precision + recall);

    perClass[label] = {
      support,
      predicted: predictedCount,
      truePositive,
      falsePositive,
      falseNegative,
      precision: round(precision),
      recall: round(recall),
      f1: round(f1),
    };
  }

  const total = predictions.length;
  const macro = (metric) =>
    SUPPORTED_LABELS.reduce((sum, label) => sum + perClass[label][metric], 0) /
    SUPPORTED_LABELS.length;
  const weighted = (metric) =>
    SUPPORTED_LABELS.reduce(
      (sum, label) => sum + perClass[label][metric] * perClass[label].support,
      0,
    ) / total;

  return {
    total,
    correct,
    available,
    unavailable: total - available,
    coverage: round(available / total),
    accuracy: round(correct / total),
    balancedAccuracy: round(macro("recall")),
    macro: {
      precision: round(macro("precision")),
      recall: round(macro("recall")),
      f1: round(macro("f1")),
    },
    weighted: {
      precision: round(weighted("precision")),
      recall: round(weighted("recall")),
      f1: round(weighted("f1")),
    },
    perClass,
    confusionMatrix: {
      orientation: "rows=actual, columns=predicted",
      columns: ["Fast", "Slow", "Unavailable"],
      rows: SUPPORTED_LABELS.map((label) => ({
        actual: label,
        ...confusion[label],
      })),
    },
  };
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function populationStandardDeviation(values) {
  const average = mean(values);
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      values.length,
  );
}

function summarizeFolds(foldMetrics) {
  const summary = {};
  for (const field of [
    "accuracy",
    "balancedAccuracy",
    "coverage",
  ]) {
    const values = foldMetrics.map((fold) => fold[field]);
    summary[field] = {
      mean: round(mean(values)),
      standardDeviation: round(populationStandardDeviation(values)),
      minimum: round(Math.min(...values)),
      maximum: round(Math.max(...values)),
    };
  }
  const macroF1Values = foldMetrics.map((fold) => fold.macro.f1);
  summary.macroF1 = {
    mean: round(mean(macroF1Values)),
    standardDeviation: round(populationStandardDeviation(macroF1Values)),
    minimum: round(Math.min(...macroF1Values)),
    maximum: round(Math.max(...macroF1Values)),
  };
  return summary;
}

async function evaluateRandomForest(
  rows,
  {
    foldCount = 5,
    seed = 42,
    treeCount = 50,
    classifierFactory = () => new RandomForestClassifier({ n_estimators: treeCount }),
  } = {},
) {
  const folds = buildStratifiedFolds(rows, foldCount, seed);
  const allPredictions = [];
  const foldResults = [];

  for (let foldIndex = 0; foldIndex < folds.length; foldIndex += 1) {
    const testingRows = folds[foldIndex];
    const trainingRows = folds.flatMap((fold, index) =>
      index === foldIndex ? [] : fold,
    );
    const classifier = classifierFactory();
    const trees = await fitClassifier(
      trainingRows,
      classifier,
      seed + foldIndex + 1,
    );

    const foldPredictions = testingRows.map((row) => {
      try {
        return {
          actual: row[TARGET_COLUMN],
          predicted: predictMovement(
            predictionRow(row),
            classifier,
            trees,
          ),
        };
      } catch (error) {
        return {
          actual: row[TARGET_COLUMN],
          predicted: "Unavailable",
          error: error.message,
        };
      }
    });
    const metrics = calculateMetrics(foldPredictions);
    allPredictions.push(...foldPredictions);
    foldResults.push({
      fold: foldIndex + 1,
      trainingRows: trainingRows.length,
      testingRows: testingRows.length,
      trainingClassDistribution: classCounts(trainingRows),
      testingClassDistribution: classCounts(testingRows),
      ...metrics,
    });
  }

  const pooled = calculateMetrics(allPredictions);
  const distribution = classCounts(rows);
  const majorityCount = Math.max(...Object.values(distribution));

  return {
    configuration: {
      classifier: "random-forest-classifier",
      treeCount,
      foldCount,
      stratified: true,
      seed,
      features: FEATURE_COLUMNS,
      target: TARGET_COLUMN,
    },
    dataset: {
      rows: rows.length,
      classDistribution: distribution,
      majorityClassBaselineAccuracy: round(majorityCount / rows.length),
    },
    crossValidation: summarizeFolds(foldResults),
    pooled,
    folds: foldResults,
  };
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function printResults(result) {
  console.log("\nRandom Forest Stratified Cross-Validation");
  console.table([
    {
      Rows: result.dataset.rows,
      Fast: result.dataset.classDistribution.Fast,
      Slow: result.dataset.classDistribution.Slow,
      Folds: result.configuration.foldCount,
      Trees: result.configuration.treeCount,
      Seed: result.configuration.seed,
    },
  ]);

  console.log("Fold results");
  console.table(
    result.folds.map((fold) => ({
      Fold: fold.fold,
      Training: fold.trainingRows,
      Testing: fold.testingRows,
      Accuracy: formatPercent(fold.accuracy),
      "Balanced Accuracy": formatPercent(fold.balancedAccuracy),
      "Macro F1": formatPercent(fold.macro.f1),
      Coverage: formatPercent(fold.coverage),
    })),
  );

  console.log("Overall pooled metrics");
  console.table([
    {
      Accuracy: formatPercent(result.pooled.accuracy),
      "Balanced Accuracy": formatPercent(result.pooled.balancedAccuracy),
      "Macro Precision": formatPercent(result.pooled.macro.precision),
      "Macro Recall": formatPercent(result.pooled.macro.recall),
      "Macro F1": formatPercent(result.pooled.macro.f1),
      "Weighted Precision": formatPercent(result.pooled.weighted.precision),
      "Weighted Recall": formatPercent(result.pooled.weighted.recall),
      "Weighted F1": formatPercent(result.pooled.weighted.f1),
      Coverage: formatPercent(result.pooled.coverage),
    },
  ]);

  console.log("Per-class metrics");
  console.table(
    SUPPORTED_LABELS.map((label) => ({
      Class: label,
      Support: result.pooled.perClass[label].support,
      Precision: formatPercent(result.pooled.perClass[label].precision),
      Recall: formatPercent(result.pooled.perClass[label].recall),
      F1: formatPercent(result.pooled.perClass[label].f1),
    })),
  );

  console.log("Confusion matrix (rows=actual, columns=predicted)");
  console.table(result.pooled.confusionMatrix.rows);

  console.log("Cross-validation summary (mean ± population standard deviation)");
  console.table([
    {
      Metric: "Accuracy",
      Mean: formatPercent(result.crossValidation.accuracy.mean),
      "Std. Dev.": formatPercent(
        result.crossValidation.accuracy.standardDeviation,
      ),
    },
    {
      Metric: "Balanced Accuracy",
      Mean: formatPercent(result.crossValidation.balancedAccuracy.mean),
      "Std. Dev.": formatPercent(
        result.crossValidation.balancedAccuracy.standardDeviation,
      ),
    },
    {
      Metric: "Macro F1",
      Mean: formatPercent(result.crossValidation.macroF1.mean),
      "Std. Dev.": formatPercent(
        result.crossValidation.macroF1.standardDeviation,
      ),
    },
  ]);
  console.log(
    `Majority-class baseline accuracy: ${formatPercent(
      result.dataset.majorityClassBaselineAccuracy,
    )}`,
  );
}

function parseInteger(value, optionName) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${optionName} must be an integer.`);
  }
  return parsed;
}

function parseArguments(args) {
  const options = {
    dataFile: DEFAULT_DATA_FILE,
    foldCount: 5,
    seed: 42,
    treeCount: 50,
    jsonFile: "",
  };

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    const value = args[index + 1];
    if (["--data", "--folds", "--seed", "--trees", "--json"].includes(option)) {
      if (!value) throw new Error(`${option} requires a value.`);
      index += 1;
    }
    if (option === "--data") options.dataFile = path.resolve(value);
    else if (option === "--folds") options.foldCount = parseInteger(value, option);
    else if (option === "--seed") options.seed = parseInteger(value, option);
    else if (option === "--trees") options.treeCount = parseInteger(value, option);
    else if (option === "--json") options.jsonFile = path.resolve(value);
    else throw new Error(`Unknown option: ${option}`);
  }

  if (options.foldCount < 2) throw new Error("--folds must be at least 2.");
  if (options.treeCount < 1) throw new Error("--trees must be at least 1.");
  return options;
}

async function main(args = process.argv.slice(2)) {
  const options = parseArguments(args);
  const rawRows = readExcelRows(options.dataFile);
  const { cleaned, skipped } = prepareTrainingRows(rawRows);
  if (!cleaned.length) throw new Error("No valid inventory training rows found.");

  const result = await evaluateRandomForest(cleaned, options);
  result.dataset.sourceFile = options.dataFile;
  result.dataset.totalWorkbookRows = rawRows.length;
  result.dataset.skippedRows = skipped;
  printResults(result);

  if (options.jsonFile) {
    fs.mkdirSync(path.dirname(options.jsonFile), { recursive: true });
    fs.writeFileSync(options.jsonFile, `${JSON.stringify(result, null, 2)}\n`);
    console.log(`JSON results: ${options.jsonFile}`);
  }
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Random Forest evaluation failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  SUPPORTED_LABELS,
  buildStratifiedFolds,
  calculateMetrics,
  createSeededRandom,
  evaluateRandomForest,
  parseArguments,
  summarizeFolds,
};
