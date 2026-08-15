/**
 * Anything outside the ASCII and Latin Extended blocks, ie. the first
 * character that proves the text is not written in the latin script
 */
const NON_LATIN_CHARACTER = /[^ -ɏ]/;

/**
 * Is the text written in the latin script, ie. is it still the english
 * word that was typed rather than a transliterated suggestion
 */
export const isLatinText = (text: string): boolean =>
  !NON_LATIN_CHARACTER.test(text);
