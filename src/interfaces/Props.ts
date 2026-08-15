import { Language } from "../types/Language";
import { TriggerKey } from "../types/TriggerKey";
import { ReactTransliterateTheme } from "../types/Theme";
import { FetchSuggestions } from "../types/SuggestionSource";

export interface ReactTransliterateProps extends React.HTMLProps<
  HTMLInputElement | HTMLTextAreaElement
> {
  /**
   * Component to render. You can pass components from your
   * component library as this prop. Default is `<input />`
   * @type React.ReactNode
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderComponent?: (props: any) => React.ReactNode;

  /**
   * Extra space between the caret and left of the helper
   * @type number
   */
  offsetX?: number;

  /**
   * Extra space between the top of the helper and bottom of the caret
   * @type number
   */
  offsetY?: number;

  /**
   * Classname passed to the container of the component
   */
  containerClassName?: string;

  /**
   * CSS styles object passed to the container
   */
  containerStyles?: React.CSSProperties;

  /**
   * CSS styles object passed to the active item `<li>` tag
   */
  activeItemStyles?: React.CSSProperties;

  /**
   * Maximum number of suggestions to show in helper
   */
  maxOptions?: number;

  /**
   * Language you want to transliterate. See the README for language codes
   */
  lang?: Language;

  /**
   * Listener for the current value from the component. `(text: string) => void`
   */
  onChangeText: (text: string) => void;

  /**
   * `value` prop to pass to the component
   */
  value: string;

  /**
   * Should the suggestions be visible on mobile devices since
   * keyboards like Gboard and Swiftkey support typing in multiple languages
   * @type boolean
   */
  hideSuggestionBoxOnMobileDevices?: boolean;

  /**
   * To be used when `hideSuggestionBoxOnMobileDevices` is true.
   * Suggestion box will not be shown below this device width
   * @type number
   */
  hideSuggestionBoxBreakpoint?: number;

  /**
   * Keys which when pressed, input the current selection to the textbox.
   *
   * Each entry is either the key itself (`" "`, `"Enter"`, `"."`) or an
   * object of the shape `{ key, insertText }` where `insertText` is the
   * text added after the suggestion. `insertText` can also be a function
   * receiving the current context, which is how the full stop key inserts
   * the purnaviram for Indic languages
   */
  triggerKeys?: TriggerKey[];

  /**
   * Character inserted by the full stop trigger key. Defaults to the
   * sentence terminator of `lang`, eg. `।` for `hi` and `.` for `en`
   */
  fullStopCharacter?: string;

  /**
   * When `Escape` is pressed, close the suggestion box and keep the typed
   * english word. Suggestions stay hidden for that word until a new word
   * is started
   * @type boolean
   */
  dismissSuggestionsOnEscape?: boolean;

  /**
   * Should the current selection be inserted when `blur` event occurs
   * @type boolean
   */
  insertCurrentSelectionOnBlur?: boolean;

  /**
   * Show current input as the last option in the suggestion box
   * @type boolean
   */
  showCurrentWordAsLastSuggestion?: boolean;

  /**
   * Control whether suggestions should be shown
   * @type boolean
   */
  enabled?: boolean;

  /**
   * Theme tokens for the suggestion box. Each token is written as a css
   * custom property on the list, so the same values can come from a
   * stylesheet instead
   */
  theme?: ReactTransliterateTheme;

  /**
   * Classname passed to the suggestion box `<ul>`
   */
  suggestionsClassName?: string;

  /**
   * Classname passed to every suggestion `<li>`
   */
  itemClassName?: string;

  /**
   * Classname passed to the highlighted suggestion `<li>`, in addition to
   * `itemClassName`
   */
  activeItemClassName?: string;

  /**
   * Where suggestions come from. Defaults to Google Input Tools. Return the
   * list of suggestions for the word being typed, in the order they should
   * be shown. The context carries the language, the full input value, the
   * bounds of the word and an `AbortSignal` that fires when the word changes
   */
  fetchSuggestions?: FetchSuggestions;

  /**
   * Wait this many milliseconds after the last keystroke before asking for
   * suggestions. Defaults to 0, which requests on every keystroke
   */
  debounceMs?: number;

  /**
   * Do not ask for suggestions until the word is at least this long.
   * Defaults to 1
   */
  minWordLength?: number;

  /**
   * Called when the suggestion source rejects. Aborted requests are not
   * reported
   */
  onSuggestionsError?: (error: unknown) => void;
}
