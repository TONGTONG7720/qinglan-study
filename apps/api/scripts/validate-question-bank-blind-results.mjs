import { blindSolverCoverage, readBlindSolverResults } from "./question-bank-blind-results.mjs";

const { inputPath, resultsPath, questions, results } = await readBlindSolverResults(
  process.argv[2],
  process.argv[3],
);

process.stdout.write(JSON.stringify({
  valid: true,
  inputPath,
  resultsPath,
  ...blindSolverCoverage(questions, results),
  referenceAnswersLoaded: false,
  databaseWritten: false,
  readyForReadOnlyComparison: true,
}));
