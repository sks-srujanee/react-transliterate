import { describe, expect, it, vi } from "vitest";
import { createAnalyzeSource } from "./analyze-source";

const context = {
  lang: "hi" as const,
  numOptions: 5,
  showCurrentWordAsLastSuggestion: true,
  value: "बड",
  matchStart: 0,
  matchEnd: 1,
  signal: new AbortController().signal,
};

const respondWith = (body: unknown) =>
  vi.fn(async () => ({ ok: true, status: 200, json: async () => body }));

describe("createAnalyzeSource", () => {
  it("reads codemix options when there are no spelling suggestions", async () => {
    const fetchMock = respondWith({
      words: [
        {
          original: "बड",
          spell_suggestions: [],
          codemix_options: ["budd", "bud"],
          start: 0,
          end: 6,
        },
      ],
    });
    vi.stubGlobal("fetch", fetchMock);

    const source = createAnalyzeSource({ url: "https://example.test/analyze" });
    await expect(source("बड", context)).resolves.toEqual({
      suggestions: ["budd", "bud"],
      allowCurrentWord: true,
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string)).toEqual({
      sentence: "बड",
      language: "hi",
    });

    vi.unstubAllGlobals();
  });

  it("orders spelling suggestions by confidence and honours minConfidence", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith({
        words: [
          {
            original: "पड़ेगा",
            spell_suggestions: [
              { word: "पड़ेगा", confidence: 0.61 },
              { word: "पडेगा", confidence: 0.75 },
              { word: "पडेग़ा", confidence: 0.57 },
            ],
            codemix_options: [],
          },
        ],
      }),
    );

    const source = createAnalyzeSource({
      url: "https://example.test/analyze",
      use: "spell",
      minConfidence: 0.6,
    });

    // the typed word is dropped, the component appends it itself
    await expect(
      source("पड़ेगा", { ...context, value: "पड़ेगा" }),
    ).resolves.toEqual({ suggestions: ["पडेगा"], allowCurrentWord: true });

    vi.unstubAllGlobals();
  });

  it("refuses a word the endpoint reports as invalid", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith({
        words: [
          {
            original: "पड़ेगा",
            spell_suggestions: [],
            codemix_options: [],
            start: 0,
          },
        ],
        validation: {
          normalized: "पड़ेगा ब  ेवेरय",
          valid: false,
          errors: [
            {
              word_index: 2,
              word: "ेवेरय",
              error_index: 0,
              error_reason: "invalid_sequence",
            },
          ],
        },
      }),
    );

    const source = createAnalyzeSource({ url: "https://example.test/analyze" });

    await expect(
      source("ेवेरय", { ...context, value: "पड़ेगा ब  ेवेरय" }),
    ).resolves.toEqual({ suggestions: [], allowCurrentWord: false });

    vi.unstubAllGlobals();
  });

  it("throws on a failing response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: async () => ({}),
      })),
    );

    const source = createAnalyzeSource({ url: "https://example.test/analyze" });
    await expect(source("बड", context)).rejects.toThrow("502");

    vi.unstubAllGlobals();
  });

  it("picks the word under the caret when sending the full sentence", async () => {
    vi.stubGlobal(
      "fetch",
      respondWith({
        words: [
          {
            original: "पड़ेगा",
            spell_suggestions: [],
            codemix_options: ["padega"],
            start: 0,
          },
          {
            original: "बड",
            spell_suggestions: [],
            codemix_options: ["bud"],
            start: 7,
          },
        ],
      }),
    );

    const source = createAnalyzeSource({
      url: "https://example.test/analyze",
      sendFullSentence: true,
    });

    await expect(
      source("बड", {
        ...context,
        value: "पड़ेगा बड",
        matchStart: 7,
        matchEnd: 8,
      }),
    ).resolves.toEqual({ suggestions: ["bud"], allowCurrentWord: true });

    vi.unstubAllGlobals();
  });
});
