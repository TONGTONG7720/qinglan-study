import { questionBankPilotSummary, readQuestionBankPilot } from "./question-bank-pilot-manifest.mjs";

const { manifestPath, manifest } = await readQuestionBankPilot(process.argv[2]);
process.stdout.write(JSON.stringify({ valid: true, manifestPath, ...questionBankPilotSummary(manifest) }));
