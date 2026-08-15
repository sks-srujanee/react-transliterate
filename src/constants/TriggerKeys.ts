export const TriggerKeys = {
  KEY_RETURN: "Enter",
  KEY_ENTER: "Enter",
  KEY_TAB: "Tab",
  KEY_SPACE: " ",
  KEY_FULL_STOP: ".",
  KEY_QUESTION_MARK: "?",
  KEY_EXCLAMATION_MARK: "!",
  KEY_COMMA: ",",
  KEY_SEMICOLON: ";",
  KEY_COLON: ":",
};

/**
 * Punctuation that commits the current selection and is inserted after it
 * followed by a space. The full stop is not part of this list because it
 * is replaced with the sentence terminator of the language
 */
export const PUNCTUATION_TRIGGER_KEYS = [
  TriggerKeys.KEY_QUESTION_MARK,
  TriggerKeys.KEY_EXCLAMATION_MARK,
  TriggerKeys.KEY_COMMA,
  TriggerKeys.KEY_SEMICOLON,
  TriggerKeys.KEY_COLON,
];
