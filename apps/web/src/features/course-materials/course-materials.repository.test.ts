import { describe, expect, it } from "vitest";

import { createCourseMaterialsRepository } from "./course-materials.repository";

describe("course materials repository", () => {
  it("returns the honest unavailable state when demo mode is disabled", async () => {
    const repository = createCourseMaterialsRepository({ demoEnabled: false });

    await expect(repository.loadCatalog()).resolves.toEqual({
      status: "unavailable",
      reason: "NOT_AUTHENTICATED",
    });
  });

  it("returns labelled development data only when demo mode is explicitly enabled", async () => {
    const repository = createCourseMaterialsRepository({ demoEnabled: true, demoDelayMs: 0 });
    const result = await repository.loadCatalog();

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.catalog.source).toBe("DEVELOPMENT_FIXTURE");
      expect(result.catalog.courses).toHaveLength(6);
      expect(result.catalog.textbookMetadata.gradeLabel).toBe("八年级");
      expect(result.catalog.textbookMetadata.termLabel).toBe("下学期");
    }
  });

  it("assembles a real catalog from authenticated textbook contexts", async () => {
    const studentUserId = "a0000000-0000-4000-8000-000000000002";
    const repository = createCourseMaterialsRepository({
      demoEnabled: false,
      request: (path) => {
        const subjectCode = path.split("/").at(-1);
        return Promise.resolve({
          mode: "GENERIC_GUIDANCE",
          studentUserId,
          subjectCode,
          grade: 7,
          hasPendingSubmission: false,
        });
      },
    });

    const result = await repository.loadCatalog(studentUserId);

    expect(result.status).toBe("ready");
    if (result.status === "ready") {
      expect(result.catalog.source).toBe("API");
      expect(result.catalog.courses).toHaveLength(5);
      expect(result.catalog.recentMaterials).toHaveLength(0);
    }
  });
});
