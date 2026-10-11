import { afterEach, expect, it, vi } from "vitest";
import {
  getPreferredSuggestion,
  rememberSuggestion,
} from "./suggestion-history-util";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

it("keeps choices separate by exact word and language", () => {
  rememberSuggestion("word", "hi", "चयन");
  expect(getPreferredSuggestion("word", "hi")).toBe("चयन");
  expect(getPreferredSuggestion("other", "hi")).toBeUndefined();
  expect(getPreferredSuggestion("word", "bn")).toBeUndefined();
});

it("bounds history and keeps a recently selected word", () => {
  for (let i = 0; i < 100; i++) rememberSuggestion(String(i), "hi", "choice");
  rememberSuggestion("0", "hi", "latest");
  rememberSuggestion("100", "hi", "choice");
  expect(getPreferredSuggestion("0", "hi")).toBe("latest");
  expect(getPreferredSuggestion("1", "hi")).toBeUndefined();
  expect(
    JSON.parse(localStorage.getItem("react-transliterate:selections")!),
  ).toHaveLength(100);
});

it.each(["invalid JSON", "{}", '[null, ["key", 4]]'])(
  "ignores malformed storage: %s",
  (stored) => {
    localStorage.setItem("react-transliterate:selections", stored);
    expect(getPreferredSuggestion("word", "hi")).toBeUndefined();
    rememberSuggestion("word", "hi", "choice");
    expect(getPreferredSuggestion("word", "hi")).toBe("choice");
  },
);

it("works without storage access", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("full");
  });
  expect(getPreferredSuggestion("word", "hi")).toBeUndefined();
  expect(() => rememberSuggestion("word", "hi", "choice")).not.toThrow();
});
