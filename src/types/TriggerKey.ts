import { Language } from "./Language";

/**
 * Information about the word that is being committed. Passed to the
 * `insertText` function of a trigger key so that the inserted text can
 * depend on the language, the suggestion or the surrounding text
 */
export interface TriggerKeyContext {
  /**
   * Key that was pressed (`event.key`)
   */
  key: string;

  /**
   * Suggestion that is about to be inserted
   */
  suggestion: string;

  /**
   * Language the component is transliterating to
   */
  lang: Language;

  /**
   * Sentence terminator for the suggestion being inserted. This is the
   * purnaviram of the language, eg. `।` for `hi`, unless the suggestion is
   * the english word that was typed, in which case it is `.`
   */
  fullStopCharacter: string;

  /**
   * Current value of the input
   */
  value: string;

  /**
   * Index of the first character of the word being replaced
   */
  matchStart: number;

  /**
   * Index of the last character of the word being replaced
   */
  matchEnd: number;
}

export interface TriggerKeyConfig {
  /**
   * Value of `event.key` that commits the current selection,
   * eg. `" "`, `"Enter"`, `"."`
   */
  key: string;

  /**
   * Text inserted after the suggestion. Defaults to a single space.
   * Pass an empty string to insert nothing, or a function to compute
   * the text from the current context
   */
  insertText?: string | ((context: TriggerKeyContext) => string);
}

export type TriggerKey = string | TriggerKeyConfig;
