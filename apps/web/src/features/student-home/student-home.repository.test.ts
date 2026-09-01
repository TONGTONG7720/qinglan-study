import { describe, expect, it } from "vitest";

import { HttpError, RequestNetworkError } from "../../api/http-client";
import { createStudentHomeRepository } from "./student-home.repository";

describe("student home repository", () => {
  it("returns unavailable in production-safe mode", async () => {
    const repository = createStudentHomeRepository({ demoEnabled: false });

    await expect(repository.loadToday()).resolves.toEqual({
      status: "unavailable",
      reason: "NOT_AUTHENTICATED",
    });
  });

  it("loads at most three labelled fixture tasks in development mode", async () => {
    const repository = createStudentHomeRepository({ demoEnabled: true, demoDelayMs: 0 });
    const result = await repository.loadToday();

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.snapshot.source).toBe("DEVELOPMENT_FIXTURE");
      expect(result.snapshot.dailyPlan.tasks).toHaveLength(3);
    }
  });

  it("loads and validates the authenticated student's real plan", async () => {
    const repository = createStudentHomeRepository({
      demoEnabled: false,
      request: (path) => Promise.resolve(path.endsWith("daily-plans/today")
        ? {
            id: "a0000000-0000-4000-8000-000000000001",
            studentUserId: "a0000000-0000-4000-8000-000000000002",
            learningDay: "2026-08-25",
            totalMinutes: 20,
            tasks: [{
              id: "a0000000-0000-4000-8000-000000000003",
              sourceType: "CURRENT_UNIT",
              sourceId: "real-unit",
              title: "后端计划任务",
              estimatedMinutes: 20,
              ordinal: 1,
              status: "PENDING",
            }],
          }
        : {
            mode: "GENERIC_GUIDANCE",
            studentUserId: "a0000000-0000-4000-8000-000000000002",
            subjectCode: "MATH",
            grade: 7,
            hasPendingSubmission: false,
          }),
    });

    const result = await repository.loadToday("a0000000-0000-4000-8000-000000000002");

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.snapshot.source).toBe("API");
      expect(result.snapshot.dailyPlan.tasks[0]?.title).toBe("后端计划任务");
    }
  });

  it("does not collapse session and network recovery failures into generic unavailable", async () => {
    const expired = createStudentHomeRepository({
      demoEnabled: false,
      request: () => Promise.reject(new HttpError(401, "expired")),
    });
    await expect(expired.loadToday("a0000000-0000-4000-8000-000000000002")).rejects.toMatchObject({ status: 401 });

    const offline = createStudentHomeRepository({
      demoEnabled: false,
      request: () => Promise.reject(new RequestNetworkError(true)),
    });
    await expect(offline.loadToday("a0000000-0000-4000-8000-000000000002")).rejects.toMatchObject({ offline: true });
  });
});
