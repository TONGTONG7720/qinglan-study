import { demoStudentHomeSnapshot } from "./demo-data";
import type { StudentHomeSnapshot } from "./types";

export function loadStudentHomeDemo(): StudentHomeSnapshot | null {
  return demoStudentHomeSnapshot;
}
