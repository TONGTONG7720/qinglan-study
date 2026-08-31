import {
  curriculumDraftSummary,
  readCurriculumDrafts,
} from "./curriculum-draft-manifest.mjs";

const { manifestPath, drafts } = await readCurriculumDrafts(process.argv[2]);
process.stdout.write(JSON.stringify({
  valid: true,
  manifestPath,
  ...curriculumDraftSummary(drafts),
}));
