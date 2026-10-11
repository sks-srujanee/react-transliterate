const STORAGE_KEY = "react-transliterate:selections";
const MAX_HISTORY = 100;

export const clearSuggestionHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be blocked; clearing history must not interrupt the editor.
  }
};

const readHistory = (): Map<string, string> => {
  try {
    const entries: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    if (!Array.isArray(entries)) return new Map();
    return new Map(
      entries
        .filter(
          (entry): entry is [string, string] =>
            Array.isArray(entry) &&
            entry.length === 2 &&
            typeof entry[0] === "string" &&
            typeof entry[1] === "string",
        )
        .slice(-MAX_HISTORY),
    );
  } catch {
    return new Map();
  }
};

export const getPreferredSuggestion = (word: string, lang: string) =>
  readHistory().get(JSON.stringify([lang, word]));

export const rememberSuggestion = (
  word: string,
  lang: string,
  suggestion: string,
) => {
  const history = readHistory();
  const key = JSON.stringify([lang, word]);
  history.delete(key);
  history.set(key, suggestion);
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...history].slice(-MAX_HISTORY)),
    );
  } catch {
    // Storage may be blocked or full; selection must still work.
  }
};
