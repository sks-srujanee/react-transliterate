import { ASCII_APOSTROPHE } from "../constants/ApostropheCharacters";
import { isLatinText } from "./script-util";

/**
 * Swap the plain apostrophe a transliteration endpoint returns for the one
 * the script actually uses.
 *
 * Only words written in the target script are touched, so the english word
 * being typed, `h'l` for Assamese `হʼল`, keeps its typewriter apostrophe
 */
export const applyApostropheCharacter = (
  word: string,
  apostrophe: string,
): string => {
  if (apostrophe === ASCII_APOSTROPHE || !word.includes(ASCII_APOSTROPHE)) {
    return word;
  }

  if (isLatinText(word)) {
    return word;
  }

  return word.split(ASCII_APOSTROPHE).join(apostrophe);
};
