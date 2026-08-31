import {
  physicalCopyReviewSummary,
  readPhysicalCopyReviews,
} from "./curriculum-physical-review.mjs";

const { inputPath, resultsPath, textbooks, reviews, textbooksById } = await readPhysicalCopyReviews(
  process.argv[2],
  process.argv[3],
);

process.stdout.write(JSON.stringify({
  valid: true,
  inputPath,
  resultsPath,
  ...physicalCopyReviewSummary(textbooks, reviews, textbooksById),
  imageBytesLoaded: false,
  databaseWritten: false,
  textbookStatusChanged: false,
  studentContextChanged: false,
}));
