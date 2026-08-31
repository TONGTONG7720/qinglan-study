import { describe, expect, it } from "vitest";
import { nextTutorStage, TutorAdvanceInputSchema } from "./tutor.js";

describe("Phase 7 tutor state machine", () => {
  it("cannot skip hints and independent answer", () => {
    expect(nextTutorStage("ASK_ATTEMPT", "SUBMIT_ATTEMPT")).toBe("HINT_ONE");
    expect(nextTutorStage("HINT_ONE", "REQUEST_NEXT")).toBe("HINT_TWO");
    expect(nextTutorStage("HINT_TWO", "REQUEST_NEXT")).toBe("EXPLANATION");
    expect(nextTutorStage("EXPLANATION", "SUBMIT_INDEPENDENT")).toBe("INDEPENDENT_ANSWER");
    expect(() => nextTutorStage("ASK_ATTEMPT", "REQUEST_NEXT")).toThrow();
    expect(() => nextTutorStage("HINT_ONE", "SUBMIT_INDEPENDENT")).toThrow();
  });
  it("requires bounded student content", () => {
    expect(TutorAdvanceInputSchema.safeParse({ action: "SUBMIT_ATTEMPT", content: "我的尝试" }).success).toBe(true);
    expect(TutorAdvanceInputSchema.safeParse({ action: "SUBMIT_ATTEMPT", content: "" }).success).toBe(false);
  });
});
