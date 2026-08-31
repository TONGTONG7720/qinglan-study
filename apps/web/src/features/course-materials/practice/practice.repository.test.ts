import { describe, expect, it } from "vitest";

import { createPracticeRepository } from "./practice.repository";

describe("practice repository", () => {
  it("does not expose the development fixture when demo mode is disabled", async () => {
    const repository = createPracticeRepository({ demoEnabled: false });
    await expect(repository.load("demo-course-math-7-autumn")).resolves.toEqual({
      status: "unavailable",
      reason: "PRACTICE_API_NOT_IMPLEMENTED",
    });
  });

  it("only resolves the fixture for its matching course", async () => {
    const repository = createPracticeRepository({ demoEnabled: true, demoDelayMs: 0 });
    await expect(repository.load("not-the-fixture-course")).resolves.toEqual({
      status: "unavailable",
      reason: "FIXTURE_NOT_AVAILABLE_FOR_COURSE",
    });
    await expect(repository.load("demo-course-math-7-autumn")).resolves.toMatchObject({ status: "ready" });
  });
});
