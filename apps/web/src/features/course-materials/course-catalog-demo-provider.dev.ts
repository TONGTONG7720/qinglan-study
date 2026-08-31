import { demoCourseCatalog } from "./demo-data";
import type { CourseCatalog } from "./types";

export function loadCourseCatalogDemo(): CourseCatalog | null {
  return demoCourseCatalog;
}
