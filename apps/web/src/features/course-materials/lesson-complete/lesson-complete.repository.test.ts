import { describe, expect, it } from "vitest";

import { lessonCompleteRepository } from "./lesson-complete.repository";

describe("lesson complete repository", () => {
  it("returns the development fixture only for its course", async () => {
    const result = await lessonCompleteRepository.load("demo-course-math-7-autumn");
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.document.source).toBe("DEVELOPMENT_FIXTURE");
  });

  it("does not reuse the fixture for another course", async () => {
    await expect(lessonCompleteRepository.load("another-course")).resolves.toEqual({ status: "unavailable", reason: "FIXTURE_NOT_AVAILABLE_FOR_COURSE" });
  });
});
