import { FetchSuggestions, SuggestionsResult } from "../types/SuggestionSource";

export interface AnalyzeWord {
  original: string;
  spell_suggestions?: Array<{
    word: string;
    score?: number;
    confidence?: number;
    reason?: string;
  }>;
  codemix_options?: string[];
  start?: number;
  end?: number;
}

export interface AnalyzeResponse {
  words?: AnalyzeWord[];
  validation?: {
    normalized?: string;
    valid?: boolean;
    errors?: Array<{
      word_index: number;
      word: string;
      error_index: number;
      error_reason: string;
    }>;
  };
  corrected_sentence?: string;
  applied_fixes?: number;
}

export interface AnalyzeSourceConfig {
  /** endpoint that accepts `{ sentence, language }` */
  url: string;

  /**
   * Which lists to read from each word.
   * - `spell` uses `spell_suggestions`, ie. corrections of an indic word
   * - `codemix` uses `codemix_options`, ie. the latin spellings
   * - `both` concatenates them, spelling corrections first
   *
   * Defaults to `both`
   */
  use?: "spell" | "codemix" | "both";

  /**
   * Drop spell suggestions below this confidence, from 0 to 1. Suggestions
   * without a confidence are kept
   */
  minConfidence?: number;

  /**
   * Send the whole input as `sentence` instead of only the word being typed,
   * which gives the endpoint the surrounding context. The suggestions are
   * still taken from the word under the caret. Defaults to `false`
   */
  sendFullSentence?: boolean;

  /**
   * Leave the typed word out of the suggestions when `validation.errors`
   * reports it, so that a word the endpoint calls invalid cannot be
   * committed. Defaults to `true`
   */
  dropInvalidWord?: boolean;

  /** extra headers, for example an authorization header */
  headers?: Record<string, string>;
}

const byConfidence = (a: { confidence?: number }, b: { confidence?: number }) =>
  (b.confidence ?? 0) - (a.confidence ?? 0);

/**
 * Suggestion source for an `/analyze` endpoint that takes a sentence and
 * returns per word spelling corrections and codemix options:
 *
 * ```ts
 * fetchSuggestions={createAnalyzeSource({
 *   url: "https://labs-prod.srujanee.in/v1/analyze",
 * })}
 * ```
 */
export const createAnalyzeSource = (
  config: AnalyzeSourceConfig,
): FetchSuggestions => {
  const {
    url,
    use = "both",
    minConfidence = 0,
    sendFullSentence = false,
    dropInvalidWord = true,
    headers = {},
  } = config;

  return async (word, context): Promise<SuggestionsResult> => {
    const sentence = sendFullSentence ? context.value : word;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ sentence, language: context.lang }),
      signal: context.signal,
    });

    if (!response.ok) {
      throw new Error(
        `analyze endpoint responded with ${response.status} ${response.statusText}`,
      );
    }

    const data: AnalyzeResponse = await response.json();
    const words = data.words ?? [];

    // with the full sentence there is a word per token, so pick the one the
    // caret is on, falling back to an exact match on the typed word
    const match =
      words.find((entry) => entry.original === word) ??
      words.find(
        (entry) =>
          entry.start !== undefined && entry.start === context.matchStart,
      ) ??
      words[0];

    // the endpoint reports words it could not parse, eg. a stray matra
    // sequence like `ेवेरय`
    const isInvalid =
      dropInvalidWord &&
      (data.validation?.errors ?? []).some((error) => error.word === word);

    if (!match) {
      return { suggestions: [], allowCurrentWord: !isInvalid };
    }

    const spelling =
      use === "codemix"
        ? []
        : (match.spell_suggestions ?? [])
            .filter(
              (suggestion) => (suggestion.confidence ?? 1) >= minConfidence,
            )
            .sort(byConfidence)
            .map((suggestion) => suggestion.word);

    const codemix = use === "spell" ? [] : (match.codemix_options ?? []);

    // the typed word is added by the component when
    // `showCurrentWordAsLastSuggestion` is on, so drop it here
    const suggestions = [...spelling, ...codemix].filter(
      (suggestion) => suggestion !== word,
    );

    return {
      suggestions: Array.from(new Set(suggestions)).slice(
        0,
        context.numOptions,
      ),
      allowCurrentWord: !isInvalid,
    };
  };
};
