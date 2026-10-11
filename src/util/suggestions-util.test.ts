import { afterEach, beforeEach, expect, it, vi } from "vitest";

let getSuggestions: typeof import("./suggestions-util").getTransliterateSuggestions;
const response = (suggestions: string[]) => ({
  ok: true,
  json: async () => ["SUCCESS", [["word", suggestions]]],
});

beforeEach(async () => {
  vi.resetModules();
  getSuggestions = (await import("./suggestions-util"))
    .getTransliterateSuggestions;
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("reuses raw results but returns independent lists and appends the current word per call", async () => {
  const fetch = vi.fn(async () => response(["पहला"]));
  vi.stubGlobal("fetch", fetch);
  const first = await getSuggestions("word");
  first[0] = "mutated";
  const onCacheHit = vi.fn();
  expect(
    await getSuggestions("word", {
      showCurrentWordAsLastSuggestion: false,
      onCacheHit,
    }),
  ).toEqual(["पहला"]);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(onCacheHit).toHaveBeenCalledOnce();
});

it("separates words, languages, and candidate counts", async () => {
  const fetch = vi.fn(async () => response(["choice"]));
  vi.stubGlobal("fetch", fetch);
  await getSuggestions("word");
  await getSuggestions("other");
  await getSuggestions("word", { lang: "bn" });
  await getSuggestions("word", { numOptions: 3 });
  expect(fetch).toHaveBeenCalledTimes(4);
});

it("expires cached suggestions after five minutes", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(async () => response(["choice"]));
  vi.stubGlobal("fetch", fetch);
  await getSuggestions("word");
  vi.advanceTimersByTime(300_001);
  await getSuggestions("word");
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("evicts the least recently used entry after 100 words", async () => {
  const fetch = vi.fn(async () => response(["choice"]));
  vi.stubGlobal("fetch", fetch);
  for (let i = 0; i < 100; i++) await getSuggestions(String(i));
  await getSuggestions("0");
  await getSuggestions("100");
  await getSuggestions("0");
  expect(fetch).toHaveBeenCalledTimes(101);
  await getSuggestions("1");
  expect(fetch).toHaveBeenCalledTimes(102);
});

it("does not cache errors, empty lists, or malformed responses", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const fetch = vi
    .fn()
    .mockResolvedValueOnce({ ok: false, status: 503 })
    .mockResolvedValueOnce(response([]))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ["SUCCESS", [["word", [null]]]],
    })
    .mockResolvedValueOnce(response(["choice"]));
  vi.stubGlobal("fetch", fetch);
  expect(await getSuggestions("word")).toEqual([]);
  expect(await getSuggestions("word")).toEqual(["word"]);
  expect(await getSuggestions("word")).toEqual(["word"]);
  expect(await getSuggestions("word")).toEqual(["choice", "word"]);
  expect(fetch).toHaveBeenCalledTimes(4);
});

it("ignores an aborted request even when its word is cached", async () => {
  const fetch = vi.fn(async () => response(["choice"]));
  vi.stubGlobal("fetch", fetch);
  await getSuggestions("word");
  const controller = new AbortController();
  controller.abort();
  expect(await getSuggestions("word", { signal: controller.signal })).toEqual(
    [],
  );
  expect(fetch).toHaveBeenCalledOnce();
});

it("encodes punctuation in the Google query", async () => {
  const fetch = vi.fn<(url: string) => Promise<ReturnType<typeof response>>>(
    async () => response(["choice"]),
  );
  vi.stubGlobal("fetch", fetch);
  await getSuggestions("a&b+#");
  expect(
    new URL(fetch.mock.calls[0][0] as string).searchParams.get("text"),
  ).toBe("a&b+#");
});
