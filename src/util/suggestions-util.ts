import { Language } from "../types/Language";

type Config = {
  numOptions?: number;
  showCurrentWordAsLastSuggestion?: boolean;
  lang?: Language;
  signal?: AbortSignal;
  onCacheHit?: () => void;
  onError?: (error: unknown) => void;
};

const cache = new Map<string, { suggestions: string[]; expiresAt: number }>();

export const getTransliterateSuggestions = async (
  word: string,
  {
    numOptions = 6,
    showCurrentWordAsLastSuggestion = true,
    lang = "hi",
    signal,
    onCacheHit,
    onError,
  }: Config = {},
): Promise<string[]> => {
  if (signal?.aborted) return [];
  const key = JSON.stringify([word, lang, numOptions]);
  const found = cache.get(key);
  const withCurrentWord = (suggestions: string[]) =>
    showCurrentWordAsLastSuggestion ? [...suggestions, word] : [...suggestions];

  if (found && found.expiresAt > Date.now()) {
    cache.delete(key);
    cache.set(key, found);
    onCacheHit?.();
    return withCurrentWord(found.suggestions);
  }
  cache.delete(key);

  const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=${lang}-t-i0-und&num=${numOptions}&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok)
      throw new Error(`Google Input Tools responded with ${res.status}`);
    const data = await res.json();
    if (signal?.aborted) return [];
    const suggestions: unknown = data?.[1]?.[0]?.[1];
    if (
      data?.[0] === "SUCCESS" &&
      Array.isArray(suggestions) &&
      suggestions.every((suggestion) => typeof suggestion === "string")
    ) {
      if (suggestions.length > 0) {
        cache.set(key, {
          suggestions: [...suggestions],
          expiresAt: Date.now() + 5 * 60_000,
        });
        if (cache.size > 100) cache.delete(cache.keys().next().value!);
      }
      return withCurrentWord(suggestions);
    }
    return showCurrentWordAsLastSuggestion ? [word] : [];
  } catch (error) {
    if (!signal?.aborted && onError) onError(error);
    else if (!signal?.aborted)
      console.error("There was an error with transliteration", error);
    return [];
  }
};
