import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { add, effects } = vi.hoisted(() => ({
  add: vi.fn(),
  effects: [] as Array<() => void>,
}));
vi.mock("@/providers/toaster", () => ({ toast: { add } }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: () => void) => effects.push(effect),
}));
import { ErrorFeedback } from "@/components/element/error-feedback";

describe("error feedback", () => {
  it("reports failures as toast without rendering inline text", () => {
    const html = renderToStaticMarkup(createElement(ErrorFeedback, { message: "Operation failed" }));
    expect(html).toBe("");
    effects.splice(0).forEach((effect) => effect());
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ title: "Operation failed", type: "error" }));
  });
  it("does not notify when there is no error", () => {
    add.mockClear();
    renderToStaticMarkup(createElement(ErrorFeedback, {}));
    effects.splice(0).forEach((effect) => effect());
    expect(add).not.toHaveBeenCalled();
  });
});
