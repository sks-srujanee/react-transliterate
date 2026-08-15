import { Language } from "./Language";

export interface FetchSuggestionsContext {
  /** language the component is transliterating to */
  lang: Language;

  /** how many suggestions the component will show */
  numOptions: number;

  /** whether the typed word is appended as the last suggestion */
  showCurrentWordAsLastSuggestion: boolean;

  /** full value of the input, for sources that need the sentence */
  value: string;

  /** index of the first character of the word being replaced */
  matchStart: number;

  /** index of the last character of the word being replaced */
  matchEnd: number;

  /** aborted when the word changes before the request settles */
  signal: AbortSignal;
}

export interface SuggestionsResult {
  /** suggestions to show, in the order they should appear */
  suggestions: string[];

  /**
   * Whether the typed word may be offered as the last suggestion. Defaults
   * to `true`. Return `false` when the source knows the word is not usable,
   * for example when a spell checker rejects it, and it will be left out
   * even with `showCurrentWordAsLastSuggestion` on
   */
  allowCurrentWord?: boolean;
}

/**
 * Returns the suggestions for `word`, either as a plain list or as a
 * `SuggestionsResult`. Reject or throw to report a failure, which is passed
 * to `onSuggestionsError`
 */
export type FetchSuggestions = (
  word: string,
  context: FetchSuggestionsContext,
) => Promise<string[] | SuggestionsResult>;
