import { AnalyzeResponse } from "./analyze-source";
import { ValidateSuggestions } from "../types/SuggestionValidator";

export interface AnalyzeValidatorConfig {
  /** endpoint that accepts `{ sentence, language }` */
  url: string;

  /**
   * Keep the suggestions when the endpoint cannot be reached, so a network
   * failure does not empty the box. Defaults to `true`
   */
  failOpen?: boolean;

  /** extra headers, for example an authorization header */
  headers?: Record<string, string>;
}

/**
 * Drops suggestions that an `/analyze` endpoint reports as invalid.
 *
 * Transliteration endpoints answer with words that no indic script allows,
 * for example `ेवेरय` for "every". The whole list is sent as one sentence and
 * every word named in `validation.errors` is removed:
 *
 * ```ts
 * validateSuggestions={createAnalyzeValidator({ url: ANALYZE_URL })}
 * ```
 */
export const createAnalyzeValidator = (
  config: AnalyzeValidatorConfig,
): ValidateSuggestions => {
  const { url, failOpen = true, headers = {} } = config;

  return async (suggestions, context) => {
    if (suggestions.length === 0) {
      return suggestions;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        // one request for the whole list, the errors name the words
        body: JSON.stringify({
          sentence: suggestions.join(" "),
          language: context.lang,
        }),
        signal: context.signal,
      });

      if (!response.ok) {
        throw new Error(
          `analyze endpoint responded with ${response.status} ${response.statusText}`,
        );
      }

      const data: AnalyzeResponse = await response.json();
      const invalid = new Set(
        (data.validation?.errors ?? []).map((error) => error.word),
      );

      if (invalid.size === 0) {
        return suggestions;
      }

      return suggestions.filter((suggestion) => !invalid.has(suggestion));
    } catch (error) {
      // an aborted request is the component moving on, not a failure
      if (failOpen && !context.signal.aborted) {
        return suggestions;
      }

      throw error;
    }
  };
};
