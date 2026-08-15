import { TriggerKey, TriggerKeyContext } from "../types/TriggerKey";
import { PUNCTUATION_TRIGGER_KEYS, TriggerKeys } from "./TriggerKeys";

/**
 * Default keys that commit the highlighted suggestion.
 *
 * - space inserts the suggestion followed by a space
 * - enter and tab insert the suggestion without a trailing space
 * - full stop inserts the suggestion followed by the sentence terminator
 *   and a space. The terminator is `.` when the suggestion is the english
 *   word that was typed and the purnaviram of the language otherwise
 * - the other punctuation keys insert the suggestion followed by the
 *   punctuation and a space
 */
export const DEFAULT_TRIGGER_KEYS: TriggerKey[] = [
  { key: TriggerKeys.KEY_SPACE, insertText: " " },
  { key: TriggerKeys.KEY_ENTER, insertText: "" },
  { key: TriggerKeys.KEY_TAB, insertText: "" },
  {
    key: TriggerKeys.KEY_FULL_STOP,
    insertText: ({ fullStopCharacter }) => `${fullStopCharacter} `,
  },
  ...PUNCTUATION_TRIGGER_KEYS.map((key) => ({
    key,
    insertText: ({ key: pressedKey }: TriggerKeyContext) => `${pressedKey} `,
  })),
];

/**
 * Text inserted after the suggestion when a trigger key is passed as a
 * plain string instead of an object
 */
export const DEFAULT_INSERT_TEXT = " ";
