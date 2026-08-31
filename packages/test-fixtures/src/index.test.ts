import { describe, expect, it } from "vitest";

import { fictionalFamily, fictionalStudent } from "./index.js";

describe("test fixtures", () => {
  it("contains clearly fictional family data", () => {
    expect(fictionalFamily.name).toContain("测试");
    expect(fictionalStudent.displayName).toContain("测试");
  });
});
