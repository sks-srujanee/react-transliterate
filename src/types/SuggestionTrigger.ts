export interface SuggestionTrigger {
  /** Prefix that opens this local list, for example "[" or "#". */
  trigger: string;
  /** Complete values to insert verbatim, including brackets or prefixes. */
  suggestions: readonly string[];
}
