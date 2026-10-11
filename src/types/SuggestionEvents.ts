import { Language } from "./Language";

export interface SuggestionSelection {
  word: string;
  suggestion: string;
  lang: Language;
  value: string;
  insertText: string;
  source: "keyboard" | "mouse" | "blur";
}

export interface SuggestionsTiming {
  word: string;
  lang: Language;
  fetchMs: number;
  validationMs: number;
  /** Includes the debounce wait. */
  totalMs: number;
  cached: boolean;
  status: "success" | "error" | "aborted";
}
