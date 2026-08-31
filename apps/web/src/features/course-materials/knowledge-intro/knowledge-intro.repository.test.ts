import { describe, expect, it } from "vitest";

import { createKnowledgeIntroRepository } from "./knowledge-intro.repository";

describe("knowledge intro repository", () => {
  it("returns the honest production-unavailable state when demo mode is off", async () => {
    const repository = createKnowledgeIntroRepository({ demoEnabled: false });

    await expect(repository.load("demo-course-math-7-autumn")).resolves.toEqual({
      status: "unavailable",
      reason: "KNOWLEDGE_INTRO_API_NOT_IMPLEMENTED",
    });
  });

  it("serves only the explicitly labelled math fixture", async () => {
    const repository = createKnowledgeIntroRepository({ demoEnabled: true, demoDelayMs: 0 });

    const result = await repository.load("demo-course-math-7-autumn");
    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.document.source).toBe("DEVELOPMENT_FIXTURE");
      expect(result.document.subjectCode).toBe("MATH");
      expect(result.document.check.correctChoiceId).toBe("B");
    }

    await expect(repository.load("demo-course-chinese-7-autumn")).resolves.toEqual({
      status: "unavailable",
      reason: "FIXTURE_NOT_AVAILABLE_FOR_COURSE",
    });
  });
});
