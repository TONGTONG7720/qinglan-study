import { describe, expect, it } from "vitest";

import { demoTaskDetailDocument } from "./demo-data";
import { createTaskDetailRepository } from "./task-detail.repository";

describe("task detail repository", () => {
  it("loads the development fixture only when explicitly enabled", async () => {
    const result = await createTaskDetailRepository({ fixtureEnabled: true, delayMs: 0 }).load(demoTaskDetailDocument.taskId);
    expect(result.status).toBe("READY_FIXTURE");
    if (result.status === "READY_FIXTURE") {
      expect(result.document.source).toBe("DEVELOPMENT_FIXTURE");
      expect(result.document.currentStep).toBe(2);
    }
  });

  it("uses one non-disclosing surface for unknown or denied task ids", async () => {
    const result = await createTaskDetailRepository({ fixtureEnabled: true, delayMs: 0 }).load("another-student-task");
    expect(result).toEqual({ status: "NOT_FOUND_OR_DENIED" });
  });

  it("returns the production-safe service boundary instead of the fixture", async () => {
    const result = await createTaskDetailRepository({ fixtureEnabled: false }).load(demoTaskDetailDocument.taskId);
    expect(result).toEqual({ status: "SERVICE_UNAVAILABLE", reason: "TASK_DETAIL_SERVICE_UNAVAILABLE" });
  });
});
