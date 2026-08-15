import { Language } from "../types/Language";

/**
 * Sentence terminator used by each language. Languages that are not
 * listed here fall back to `DEFAULT_FULL_STOP_CHARACTER`
 */
export const FULL_STOP_CHARACTERS: Partial<Record<Language, string>> = {
  // purnaviram / danda
  bn: "।",
  gu: "।",
  hi: "।",
  mr: "।",
  ne: "।",
  or: "।",
  pa: "।",
  sa: "।",
  // arabic full stop
  ur: "۔",
  // ideographic full stop
  ja: "。",
  zh: "。",
  "zh-hant": "。",
  "yue-hant": "。",
  // ethiopic full stop
  am: "።",
  ti: "።",
};

export const DEFAULT_FULL_STOP_CHARACTER = ".";

export const getFullStopCharacter = (lang: Language): string =>
  FULL_STOP_CHARACTERS[lang] ?? DEFAULT_FULL_STOP_CHARACTER;
