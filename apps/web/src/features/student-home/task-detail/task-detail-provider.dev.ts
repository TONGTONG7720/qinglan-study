import { demoTaskDetailDocument } from "./demo-data";
import type { TaskDetailDocument } from "./types";

export function loadTaskDetailFixture(): TaskDetailDocument | null {
  return demoTaskDetailDocument;
}
