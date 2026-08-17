import { FetchSuggestionsContext } from "./SuggestionSource";

export type ValidateSuggestionsContext = FetchSuggestionsContext;

/**
 * Receives the suggestions a source produced and returns the ones to keep.
 * Runs after the local script check, so it only sees well formed words.
 * Reject or throw to report a failure to `onSuggestionsError`
 */
export type ValidateSuggestions = (
  suggestions: string[],
  context: ValidateSuggestionsContext,
) => Promise<string[]>;
