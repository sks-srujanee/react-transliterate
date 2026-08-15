/**
 * Indic blocks that share the ISCII derived layout, from Devanagari through
 * Sinhala. Within each block the offset of a codepoint tells what it is
 */
const FIRST_INDIC_CODEPOINT = 0x0900;
const LAST_INDIC_CODEPOINT = 0x0dff;

// offsets inside a block
const SIGN_FIRST = 0x00; // chandrabindu, anusvara, visarga
const SIGN_LAST = 0x03;
const NUKTA = 0x3c;
const MATRA_FIRST = 0x3e; // dependent vowel signs
const MATRA_LAST = 0x4c;
const VIRAMA = 0x4d;
const EXTRA_MARK_FIRST = 0x51; // stress and length marks
const EXTRA_MARK_LAST = 0x57;
const VOCALIC_MATRA_FIRST = 0x62;
const VOCALIC_MATRA_LAST = 0x63;

const isIndic = (codepoint: number) =>
  codepoint >= FIRST_INDIC_CODEPOINT && codepoint <= LAST_INDIC_CODEPOINT;

const offsetOf = (codepoint: number) => codepoint & 0x7f;

const isMatra = (codepoint: number) => {
  const offset = offsetOf(codepoint);
  return (
    (offset >= MATRA_FIRST && offset <= MATRA_LAST) ||
    (offset >= VOCALIC_MATRA_FIRST && offset <= VOCALIC_MATRA_LAST)
  );
};

/**
 * Marks that cannot stand on their own, ie. everything that has to follow a
 * consonant or a vowel
 */
const isCombiningMark = (codepoint: number) => {
  const offset = offsetOf(codepoint);
  return (
    (offset >= SIGN_FIRST && offset <= SIGN_LAST) ||
    offset === NUKTA ||
    (offset >= MATRA_FIRST && offset <= VIRAMA) ||
    (offset >= EXTRA_MARK_FIRST && offset <= EXTRA_MARK_LAST) ||
    (offset >= VOCALIC_MATRA_FIRST && offset <= VOCALIC_MATRA_LAST)
  );
};

/**
 * Is the word a sequence an indic script actually allows.
 *
 * Transliteration endpoints sometimes answer with sequences that cannot be
 * typed, such as `ेवेरय` for "every", which opens on a dependent vowel sign.
 * Words with no indic characters, for example the english word being typed,
 * are always accepted.
 *
 * Rejects a word that
 * - opens with a combining mark, which has nothing to attach to
 * - carries two dependent vowel signs in a row
 * - places a dependent vowel sign directly after a virama
 */
export const isValidIndicWord = (word: string): boolean => {
  const codepoints = Array.from(word).map((character) =>
    character.codePointAt(0),
  ) as number[];

  const firstIndic = codepoints.findIndex(isIndic);

  // nothing from an indic block, so there is nothing to validate
  if (firstIndic === -1) {
    return true;
  }

  if (isCombiningMark(codepoints[firstIndic])) {
    return false;
  }

  for (let index = 1; index < codepoints.length; index += 1) {
    const previous = codepoints[index - 1];
    const current = codepoints[index];

    if (!isIndic(current) || !isIndic(previous)) {
      continue;
    }

    if (isMatra(current) && isMatra(previous)) {
      return false;
    }

    if (isMatra(current) && offsetOf(previous) === VIRAMA) {
      return false;
    }
  }

  return true;
};
