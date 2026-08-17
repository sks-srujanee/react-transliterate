import { describe, expect, it, vi } from "vitest";
import { createAnalyzeValidator } from "./analyze-validator";

const context = {
  lang: "hi" as const,
  numOptions: 5,
  showCurrentWordAsLastSuggestion: true,
  value: "every",
  matchStart: 0,
  matchEnd: 4,
  signal: new AbortController().signal,
};

// what the endpoint answers for the five suggestions google returns
const analyzeResponse = {
  words: [],
  validation: {
    normalized: "एव्री एवेरी एवेर्य ेवेरय एवेरय",
    valid: false,
    errors: [
      {
        word_index: 3,
        word: "ेवेरय",
        error_index: 0,
        error_reason: "invalid_sequence",
      },
    ],
  },
};

const suggestions = ["एव्री", "एवेरी", "एवेर्य", "ेवेरय", "एवेरय"];

describe("createAnalyzeValidator", () => {
  it("removes the words the endpoint reports as invalid", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => analyzeResponse,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const validate = createAnalyzeValidator({
      url: "https://example.test/analyze",
    });

    await expect(validate(suggestions, context)).resolves.toEqual([
      "एव्री",
      "एवेरी",
      "एवेर्य",
      "एवेरय",
    ]);

    // the whole list goes out as one sentence
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string)).toEqual({
      sentence: suggestions.join(" "),
      language: "hi",
    });

    vi.unstubAllGlobals();
  });

  it("keeps every suggestion when the endpoint reports none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ validation: { valid: true, errors: [] } }),
      })),
    );

    const validate = createAnalyzeValidator({
      url: "https://example.test/analyze",
    });

    await expect(validate(suggestions, context)).resolves.toEqual(suggestions);

    vi.unstubAllGlobals();
  });

  it("does not call the endpoint for an empty list", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const validate = createAnalyzeValidator({
      url: "https://example.test/analyze",
    });

    await expect(validate([], context)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("keeps the suggestions when the endpoint fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const validate = createAnalyzeValidator({
      url: "https://example.test/analyze",
    });

    await expect(validate(suggestions, context)).resolves.toEqual(suggestions);

    vi.unstubAllGlobals();
  });

  it("reports the failure when failOpen is off", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        statusText: "Server Error",
        json: async () => ({}),
      })),
    );

    const validate = createAnalyzeValidator({
      url: "https://example.test/analyze",
      failOpen: false,
    });

    await expect(validate(suggestions, context)).rejects.toThrow("500");

    vi.unstubAllGlobals();
  });
});
