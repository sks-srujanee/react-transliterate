import { Language } from "../types/Language";

/**
 * The plain apostrophe that transliteration endpoints answer with
 */
export const ASCII_APOSTROPHE = "'";

/**
 * Apostrophe each language wants in its own script. Assamese writes the
 * urdha coma, which is a letter rather than punctuation, so it is
 * U+02BC MODIFIER LETTER APOSTROPHE and not the U+0027 that Google Input
 * Tools returns. Languages that are not listed keep U+0027
 */
export const APOSTROPHE_CHARACTERS: Partial<Record<Language, string>> = {
  as: "ʼ",
};

export const getApostropheCharacter = (lang: Language): string =>
  APOSTROPHE_CHARACTERS[lang] ?? ASCII_APOSTROPHE;
