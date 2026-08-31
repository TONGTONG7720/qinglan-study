import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { demoPractice } from "./demo-data";
import { StructuredApplicationQuestion } from "./StructuredApplicationQuestion";
import type { StructuredApplicationPracticeQuestion } from "./types";
import { useStructuredApplicationSession } from "./use-structured-application-session";

function getQuestion(): StructuredApplicationPracticeQuestion {
  const question = demoPractice.questions.find(
    (item): item is StructuredApplicationPracticeQuestion => item.kind === "STRUCTURED_APPLICATION",
  );
  if (question === undefined) throw new Error("Q5 fixture missing");
  return question;
}

function Harness() {
  const question = getQuestion();
  const session = useStructuredApplicationSession(question);
  return <StructuredApplicationQuestion question={question} session={session} />;
}

describe("StructuredApplicationQuestion", () => {
  it("renders semantic grouped fields with empty values and no answer placeholders", () => {
    render(<Harness />);
    expect(screen.getAllByRole("group")).toHaveLength(3);
    expect(screen.getByRole("textbox", { name: "最高点横坐标 x" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "最高点纵坐标 y" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "第一个地面交点横坐标 x₁" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "第二个地面交点横坐标 x₂" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "拱门宽度" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "判断依据" })).toHaveValue("");
    expect(screen.getAllByText("未完成")).toHaveLength(4);
    expect(screen.getByText("0 / 120")).toBeInTheDocument();
  });

  it("associates format errors and order errors with the corresponding inputs", () => {
    render(<Harness />);
    const first = screen.getByRole("textbox", { name: "第一个地面交点横坐标 x₁" });
    const second = screen.getByRole("textbox", { name: "第二个地面交点横坐标 x₂" });
    fireEvent.change(first, { target: { value: "8" } });
    fireEvent.change(second, { target: { value: "1" } });
    fireEvent.blur(second);
    expect(second).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("请按从小到大填写")).toBeInTheDocument();
  });

  it("updates the character count and completion checklist from actual field values", () => {
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox", { name: "最高点横坐标 x" }), { target: { value: "7" } });
    fireEvent.change(screen.getByRole("textbox", { name: "最高点纵坐标 y" }), { target: { value: "9" } });
    expect(screen.getByText("最高点坐标").closest("li")).toHaveClass("is-complete");

    fireEvent.change(screen.getByRole("textbox", { name: "判断依据" }), { target: { value: "我先区分每个量的实际含义。" } });
    expect(screen.getByText("13 / 120")).toBeInTheDocument();
    expect(screen.getByText("判断依据", { selector: "li span" }).closest("li")).toHaveClass("is-complete");
  });
});
