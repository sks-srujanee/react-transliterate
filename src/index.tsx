import * as React from "react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from "react";
import { getInputSelection, isTouchEnabled, isLatinText } from "./util";
import getCaretCoordinates from "textarea-caret";
import { getEditableCaretCoordinates } from "./util/editable-util";
import { ContentEditable } from "./ContentEditable";
import type { ContentEditableProps } from "./ContentEditable";
import classes from "./styles.module.css";
// the same stylesheet as a string, injected so that consumers do not have to
// import `dist/index.css` themselves
import css from "./styles.module.css?inline";
import { ReactTransliterateProps } from "./interfaces/Props";
import { Language } from "./types/Language";
import { PUNCTUATION_TRIGGER_KEYS, TriggerKeys } from "./constants/TriggerKeys";
import {
  DEFAULT_INSERT_TEXT,
  DEFAULT_TRIGGER_KEYS,
} from "./constants/DefaultTriggerKeys";
import {
  DEFAULT_FULL_STOP_CHARACTER,
  getFullStopCharacter,
} from "./constants/FullStopCharacters";
import { TriggerKey, TriggerKeyConfig } from "./types/TriggerKey";
import {
  getTransliterateSuggestions,
  warmUpTransliteration,
} from "./util/suggestions-util";
import { injectStyles } from "./util/style-util";
import { FetchSuggestions, SuggestionsResult } from "./types/SuggestionSource";
import { createAnalyzeSource } from "./sources/analyze-source";
import { createAnalyzeValidator } from "./sources/analyze-validator";
import {
  APOSTROPHE_CHARACTERS,
  getApostropheCharacter,
} from "./constants/ApostropheCharacters";
import { applyApostropheCharacter } from "./util/apostrophe-util";
import { ValidateSuggestions } from "./types/SuggestionValidator";
import { SuggestionTrigger } from "./types/SuggestionTrigger";
import {
  getPreferredSuggestion,
  rememberSuggestion,
  clearSuggestionHistory,
} from "./util/suggestion-history-util";
import { getSuggestionPosition } from "./util/suggestion-position-util";
import {
  SuggestionSelection,
  SuggestionsTiming,
} from "./types/SuggestionEvents";

injectStyles(css);

const KEY_UP = "ArrowUp";
const KEY_DOWN = "ArrowDown";
const KEY_ESCAPE = "Escape";

let instanceCount = 0;

export const ReactTransliterate = ({
  renderComponent = (props) => <input {...props} />,
  lang = "hi",
  offsetX = 0,
  offsetY = 10,
  onChange,
  onChangeText,
  onBlur,
  value,
  onKeyDown,
  onCompositionStart,
  onCompositionEnd,
  onSelect,
  containerClassName = "",
  containerStyles = {},
  activeItemStyles = {},
  highlightColor,
  suggestionTriggers = [],
  maxOptions = 7,
  hideSuggestionBoxOnMobileDevices = false,
  hideSuggestionBoxBreakpoint = 450,
  triggerKeys = DEFAULT_TRIGGER_KEYS,
  fullStopCharacter,
  dismissSuggestionsOnEscape = true,
  insertCurrentSelectionOnBlur = true,
  showCurrentWordAsLastSuggestion = true,
  enabled = true,
  suggestionsClassName = "",
  itemClassName = "",
  activeItemClassName = "",
  fetchSuggestions,
  validateSuggestions,
  apostropheCharacter,
  debounceMs = 0,
  minWordLength = 1,
  onSuggestionsError,
  rememberSelections = true,
  onSuggestionSelect,
  onSuggestionsTiming,
  ...rest
}: ReactTransliterateProps): React.JSX.Element => {
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingNotice, setLoadingNotice] = useState(false);
  const [listId, setListId] = useState("");
  const loadingRef = useRef(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composingRef = useRef(false);
  const compositionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const caretTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoRef = useRef<{
    before: string;
    after: string;
    start: number;
    end: number;
  } | null>(null);
  const [left, setLeft] = useState(0);
  const [top, setTop] = useState(0);
  const [selection, setSelection] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listSizeRef = useRef({ width: 0, height: 0 });
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  // start index of the word for which the suggestion box was closed
  // with the escape key. `null` when no word is dismissed
  const dismissedWordStartRef = useRef<number | null>(null);

  /**
   * `blur` can fire in the same tick as a state update, for example when a
   * parent escape handler calls `document.activeElement.blur()` after this
   * component has already handled the same keydown. The state update is only
   * queued at that point, so a handler that reads `options` or `selection`
   * from the render closure can see the previous value. Every handler that
   * can run before the re-render reads these refs instead, and the render
   * output keeps using the state.
   *
   * The match bounds are only ever read from handlers, so they are kept in
   * refs alone
   */
  const optionsRef = useRef<string[]>([]);
  // latest value, which during `change` is ahead of the `value` prop
  const valueRef = useRef(value);
  const selectionRef = useRef(0);
  const manualSelectionRef = useRef(false);
  const localTriggerRef = useRef<string | null>(null);
  const queryCaretRef = useRef<{ start: number; end: number } | null>(null);
  const matchStartRef = useRef(-1);
  const matchEndRef = useRef(-1);

  const applyOptions = (next: string[]) => {
    const unique = Array.from(new Set(next)).slice(0, Math.max(0, maxOptions));
    optionsRef.current = unique;
    setOptions(unique);
  };

  const applySelection = (next: number, manual = false) => {
    selectionRef.current = next;
    manualSelectionRef.current = manual;
    setSelection(next);
  };

  const applyLoading = (next: boolean) => {
    if (loadingTimeoutRef.current !== null)
      clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = null;
    setLoadingNotice(false);
    loadingRef.current = next;
    setLoading(next);
    if (next)
      loadingTimeoutRef.current = setTimeout(() => setLoadingNotice(true), 300);
  };

  // in flight suggestion request, aborted when the word changes
  const requestControllerRef = useRef<AbortController | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingRequest = () => {
    if (loadingTimeoutRef.current !== null)
      clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = null;
    if (debounceTimeoutRef.current !== null) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
  };

  // pending insertion scheduled by `blur`, see `handleBlur`
  const blurInsertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const cancelBlurInsert = () => {
    if (blurInsertTimeoutRef.current !== null) {
      clearTimeout(blurInsertTimeoutRef.current);
      blurInsertTimeoutRef.current = null;
    }
  };

  const applyMatch = (start: number, end: number) => {
    matchStartRef.current = start;
    matchEndRef.current = end;
  };

  // assamese and friends write the apostrophe as a letter of their own
  // script, which the transliteration endpoints do not return
  const scriptApostrophe = apostropheCharacter ?? getApostropheCharacter(lang);

  // the english word is kept as is, so it ends with a full stop even when
  // the language uses a purnaviram
  const getSentenceTerminator = (suggestion: string) =>
    isLatinText(suggestion)
      ? DEFAULT_FULL_STOP_CHARACTER
      : (fullStopCharacter ?? getFullStopCharacter(lang));

  const triggerKeyMap = useMemo(() => {
    const map = new Map<string, TriggerKeyConfig>();

    triggerKeys.forEach((triggerKey: TriggerKey) => {
      const config =
        typeof triggerKey === "string" ? { key: triggerKey } : triggerKey;
      map.set(config.key, config);
    });

    return map;
  }, [triggerKeys]);

  const shouldRenderSuggestions = useMemo(
    () =>
      hideSuggestionBoxOnMobileDevices
        ? windowSize.width > hideSuggestionBoxBreakpoint
        : true,
    [windowSize, hideSuggestionBoxBreakpoint, hideSuggestionBoxOnMobileDevices],
  );

  const reset = () => {
    // reset the component
    cancelPendingRequest();
    applyLoading(false);
    listSizeRef.current = { width: 0, height: 0 };
    applySelection(0);
    applyOptions([]);
    localTriggerRef.current = null;
    queryCaretRef.current = null;
  };

  const getInsertText = (config: TriggerKeyConfig, suggestion: string) => {
    const { insertText = DEFAULT_INSERT_TEXT } = config;

    if (typeof insertText === "string") {
      return insertText;
    }

    return insertText({
      key: config.key,
      suggestion,
      lang,
      fullStopCharacter: getSentenceTerminator(suggestion),
      value,
      matchStart: matchStartRef.current,
      matchEnd: matchEndRef.current,
    });
  };

  const scheduleCaret = (start: number, end = start) => {
    if (caretTimeoutRef.current !== null) clearTimeout(caretTimeoutRef.current);
    caretTimeoutRef.current = setTimeout(() => {
      caretTimeoutRef.current = null;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(start, end);
    }, 0);
  };

  const handleSelection = (
    index: number,
    insertText = DEFAULT_INSERT_TEXT,
    source: SuggestionSelection["source"] = "mouse",
  ) => {
    if (loadingRef.current) return;
    const currentString = valueRef.current;
    const suggestion = optionsRef.current[index];
    if (suggestion === undefined) return;
    const caret = getInputSelection(inputRef.current!);
    const queryCaret = queryCaretRef.current;
    if (
      queryCaret &&
      (caret.start !== queryCaret.start || caret.end !== queryCaret.end)
    ) {
      reset();
      return;
    }
    const start = matchStartRef.current;
    const end = matchEndRef.current;
    const suffix = currentString.substring(end + 1);
    if (insertText === DEFAULT_INSERT_TEXT && /^[\s.,!?;:]/.test(suffix))
      insertText = "";
    const word = currentString.slice(start, end + 1);
    if (rememberSelections && localTriggerRef.current === null)
      rememberSuggestion(word, lang, suggestion);

    // create a new string with the currently typed word
    // replaced with the word in transliterated language
    const newValue =
      currentString.substring(0, start) + suggestion + insertText + suffix;

    undoRef.current = { before: currentString, after: newValue, ...caret };
    valueRef.current = newValue;
    scheduleCaret(start + suggestion.length + insertText.length);

    // the word was replaced, so any escape dismissal for it no longer applies
    dismissedWordStartRef.current = null;

    // bubble up event to the parent component
    const e = {
      target: { value: newValue },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    onChangeText(newValue);
    onChange?.(e);
    onSuggestionSelect?.({
      word,
      suggestion,
      lang,
      value: newValue,
      insertText,
      source,
    });
    reset();
    return inputRef.current?.focus();
  };

  const requestSuggestions = (lastWord: string) => {
    if (!shouldRenderSuggestions) {
      return;
    }

    if (lastWord.length < minWordLength) {
      reset();
      return;
    }

    cancelPendingRequest();
    applyLoading(true);
    const requestedAt = performance.now();

    const numOptions = showCurrentWordAsLastSuggestion
      ? maxOptions - 1
      : maxOptions;

    const run = async () => {
      const controller = new AbortController();
      requestControllerRef.current = controller;
      const fetchStarted = performance.now();
      let fetchMs: number | undefined;
      let validationStarted: number | undefined;
      let validationMs: number | undefined;
      let cached = false;
      let status: SuggestionsTiming["status"] = "success";

      try {
        const result = fetchSuggestions
          ? await fetchSuggestions(lastWord, {
              lang,
              numOptions,
              showCurrentWordAsLastSuggestion,
              value: valueRef.current,
              matchStart: matchStartRef.current,
              matchEnd: matchEndRef.current,
              signal: controller.signal,
            })
          : await getTransliterateSuggestions(lastWord, {
              numOptions,
              showCurrentWordAsLastSuggestion,
              lang,
              signal: controller.signal,
              onCacheHit: () => {
                cached = true;
              },
              onError: (error) => {
                throw error;
              },
            });
        fetchMs = performance.now() - fetchStarted;

        // a newer keystroke already replaced this request
        if (controller.signal.aborted) {
          return;
        }

        const suggestions = Array.isArray(result)
          ? result
          : (result as SuggestionsResult).suggestions;

        // a source can refuse the typed word, for example when a spell
        // checker reports it as invalid
        const allowCurrentWord = Array.isArray(result)
          ? true
          : ((result as SuggestionsResult).allowCurrentWord ?? true);

        const withCurrentWord =
          fetchSuggestions &&
          showCurrentWordAsLastSuggestion &&
          allowCurrentWord
            ? [...suggestions, lastWord]
            : suggestions;

        // an endpoint gets the last word on what is shown
        if (validateSuggestions) validationStarted = performance.now();
        const validated = validateSuggestions
          ? await validateSuggestions(withCurrentWord, {
              lang,
              numOptions,
              showCurrentWordAsLastSuggestion,
              value: valueRef.current,
              matchStart: matchStartRef.current,
              matchEnd: matchEndRef.current,
              signal: controller.signal,
            })
          : withCurrentWord;
        validationMs =
          validationStarted === undefined
            ? 0
            : performance.now() - validationStarted;

        if (controller.signal.aborted) {
          return;
        }

        const next = validated.map((suggestion) =>
          applyApostropheCharacter(suggestion, scriptApostrophe),
        );
        const preferred = rememberSelections
          ? getPreferredSuggestion(lastWord, lang)
          : undefined;
        const preferredIndex =
          preferred === undefined ? -1 : next.indexOf(preferred);
        if (preferredIndex > 0) {
          next.unshift(...next.splice(preferredIndex, 1));
        }
        const selected = manualSelectionRef.current
          ? optionsRef.current[selectionRef.current]
          : undefined;
        applyOptions(next);
        const selectedIndex =
          selected === undefined ? -1 : optionsRef.current.indexOf(selected);
        applySelection(Math.max(0, selectedIndex), selectedIndex >= 0);
        applyLoading(false);
      } catch (error) {
        status = controller.signal.aborted ? "aborted" : "error";
        if (controller.signal.aborted) {
          return;
        }

        onSuggestionsError?.(error);
        reset();
      } finally {
        const endedAt = performance.now();
        if (status === "success" && controller.signal.aborted)
          status = "aborted";
        onSuggestionsTiming?.({
          word: lastWord,
          lang,
          cached,
          status,
          fetchMs: fetchMs ?? endedAt - fetchStarted,
          validationMs:
            validationMs ??
            (validationStarted === undefined ? 0 : endedAt - validationStarted),
          totalMs: endedAt - requestedAt,
        });
      }
    };

    if (debounceMs > 0) {
      debounceTimeoutRef.current = setTimeout(run, debounceMs);
      return;
    }

    run();
  };

  const updatePosition = useCallback(() => {
    const input = inputRef.current;
    const container = containerRef.current;
    if (!input || !container || matchStartRef.current < 0) return;
    const caret = input.isContentEditable
      ? getEditableCaretCoordinates(input, matchStartRef.current)
      : getCaretCoordinates(input, matchStartRef.current);
    const rect = input.getBoundingClientRect();
    const origin = container.getBoundingClientRect();
    const anchorTop = rect.top + caret.top - input.scrollTop;
    const position = getSuggestionPosition(
      {
        left: rect.left + caret.left - input.scrollLeft + offsetX,
        top: anchorTop - offsetY,
        bottom:
          anchorTop +
          (Number.isFinite(caret.height) ? caret.height : 20) +
          offsetY,
      },
      listSizeRef.current,
      {
        width: window.visualViewport?.width ?? window.innerWidth,
        height: window.visualViewport?.height ?? window.innerHeight,
        left: window.visualViewport?.offsetLeft ?? 0,
        top: window.visualViewport?.offsetTop ?? 0,
      },
    );
    setLeft(position.left - origin.left);
    setTop(position.top - origin.top);
    if (listRef.current) {
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      listRef.current.style.minWidth = `${Math.min(listSizeRef.current.width, Math.max(0, viewportWidth - 16))}px`;
      listRef.current.style.maxWidth = `${Math.max(0, Math.min(320, viewportWidth - 16))}px`;
      listRef.current.style.maxHeight = `${position.maxHeight}px`;
    }
  }, [offsetX, offsetY]);

  const updateSuggestions = (input: HTMLInputElement, value: string) => {
    if (!shouldRenderSuggestions) {
      return;
    }

    const selection = getInputSelection(input);
    if (selection.start !== selection.end) {
      reset();
      return;
    }
    const caret = selection.end;
    const prefix = value.slice(0, caret).match(/\S*$/)?.[0] ?? "";
    const local = suggestionTriggers.find(
      ({ trigger }) => trigger.length > 0 && prefix.startsWith(trigger),
    );
    const before = local
      ? prefix
      : (value.slice(0, caret).match(/[\p{L}\p{M}\p{N}'’ʼ]+$/u)?.[0] ?? "");
    const after =
      value
        .slice(caret)
        .match(local ? /^[^\s.,!?;:]*/ : /^[\p{L}\p{M}\p{N}'’ʼ]*/u)?.[0] ?? "";
    const start = caret - before.length;
    applyMatch(start, caret + after.length - 1);
    queryCaretRef.current = selection;

    // the caret moved to a different word, so the word that was dismissed
    // with the escape key is no longer being typed
    if (
      dismissedWordStartRef.current !== null &&
      dismissedWordStartRef.current !== start
    ) {
      dismissedWordStartRef.current = null;
    }

    const isDismissed = dismissedWordStartRef.current === start;

    // currentWord is the word that is being typed
    const currentWord = before + after;
    if (before && enabled && !isDismissed) {
      if (local) {
        cancelPendingRequest();
        applyLoading(false);
        if (localTriggerRef.current !== local.trigger) {
          listSizeRef.current = { width: 0, height: 0 };
          applySelection(0);
        }
        localTriggerRef.current = local.trigger;
        const selected = manualSelectionRef.current
          ? optionsRef.current[selectionRef.current]
          : undefined;
        applyOptions(
          local.suggestions.filter((suggestion) =>
            suggestion.toLowerCase().startsWith(prefix.toLowerCase()),
          ),
        );
        const selectedIndex =
          selected === undefined ? -1 : optionsRef.current.indexOf(selected);
        applySelection(Math.max(0, selectedIndex), selectedIndex >= 0);
        updatePosition();
        return;
      }
      if (localTriggerRef.current !== null) {
        reset();
        queryCaretRef.current = selection;
      }
      // make an api call to fetch suggestions
      requestSuggestions(currentWord);
      updatePosition();
    } else {
      reset();
    }
  };

  const inputTrigger = (inputType: string, data: string | null) => {
    const key = ["insertLineBreak", "insertParagraph"].includes(inputType)
      ? "Enter"
      : inputType === "insertText"
        ? data
        : null;
    if (key === null || loadingRef.current || optionsRef.current.length === 0)
      return;
    return localTriggerRef.current !== null
      ? key === "Enter"
        ? { key }
        : undefined
      : triggerKeyMap.get(key);
  };

  // Some mobile keyboards send input events instead of usable keydowns.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const beforeInput = (event: InputEvent) => {
      if (
        event.defaultPrevented ||
        !event.cancelable ||
        event.isComposing ||
        composingRef.current
      )
        return;
      const trigger = inputTrigger(event.inputType, event.data);
      const caret = getInputSelection(input);
      const expected = queryCaretRef.current;
      if (
        !trigger ||
        !expected ||
        caret.start !== expected.start ||
        caret.end !== expected.end
      )
        return;
      event.preventDefault();
      handleSelection(
        selectionRef.current,
        getInsertText(trigger, optionsRef.current[selectionRef.current]),
        "keyboard",
      );
    };
    input.addEventListener("beforeinput", beforeInput);
    return () => input.removeEventListener("beforeinput", beforeInput);
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    const native = e.nativeEvent as InputEvent;
    const trigger = inputTrigger(native.inputType, native.data);
    const expected = queryCaretRef.current;
    const inserted = ["insertLineBreak", "insertParagraph"].includes(
      native.inputType,
    )
      ? "\n"
      : native.data;
    if (
      !composingRef.current &&
      !native.isComposing &&
      trigger &&
      expected &&
      expected.start === expected.end &&
      inserted &&
      value ===
        valueRef.current.slice(0, expected.end) +
          inserted +
          valueRef.current.slice(expected.end) &&
      getInputSelection(e.currentTarget).end === expected.end + inserted.length
    ) {
      // Non-cancelable beforeinput: accept only an exact single trigger insertion.
      e.currentTarget.setSelectionRange(expected.start, expected.end);
      handleSelection(
        selectionRef.current,
        getInsertText(trigger, optionsRef.current[selectionRef.current]),
        "keyboard",
      );
      return;
    }
    valueRef.current = value;
    undoRef.current = null;
    if (caretTimeoutRef.current !== null) clearTimeout(caretTimeoutRef.current);
    caretTimeoutRef.current = null;
    if (compositionTimeoutRef.current !== null)
      clearTimeout(compositionTimeoutRef.current);
    compositionTimeoutRef.current = null;
    onChange?.(e);
    onChangeText(value);
    if (!composingRef.current && inputRef.current)
      updateSuggestions(inputRef.current, value);
  };

  const handleSelect = (event: React.SyntheticEvent<HTMLInputElement>) => {
    // wrapper components such as Material UI attach `onSelect` to a root
    // element, where `currentTarget` is not the editable element
    const caret = getInputSelection(inputRef.current ?? event.currentTarget);
    const queryCaret = queryCaretRef.current;
    if (
      queryCaret &&
      (caret.start !== queryCaret.start || caret.end !== queryCaret.end)
    ) {
      cancelBlurInsert();
      reset();
    }
    onSelect?.(event);
  };

  const handleCompositionStart = (
    event: React.CompositionEvent<HTMLInputElement>,
  ) => {
    composingRef.current = true;
    if (compositionTimeoutRef.current !== null)
      clearTimeout(compositionTimeoutRef.current);
    compositionTimeoutRef.current = null;
    cancelBlurInsert();
    reset();
    onCompositionStart?.(event);
  };

  const handleCompositionEnd = (
    event: React.CompositionEvent<HTMLInputElement>,
  ) => {
    composingRef.current = false;
    const input = inputRef.current ?? event.currentTarget;
    valueRef.current = input.value;
    // A following change event uses the final value and cancels this fallback.
    compositionTimeoutRef.current = setTimeout(() => {
      compositionTimeoutRef.current = null;
      if (document.activeElement === input)
        updateSuggestions(input, input.value);
    }, 0);
    onCompositionEnd?.(event);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      composingRef.current ||
      event.nativeEvent.isComposing ||
      event.keyCode === 229
    ) {
      onKeyDown?.(event);
      return;
    }
    const undo = undoRef.current;
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      !event.altKey &&
      event.key.toLowerCase() === "z" &&
      undo &&
      valueRef.current === undo.after
    ) {
      event.preventDefault();
      undoRef.current = null;
      cancelBlurInsert();
      reset();
      valueRef.current = undo.before;
      onChangeText(undo.before);
      onChange?.({
        target: { value: undo.before },
      } as React.ChangeEvent<HTMLInputElement>);
      scheduleCaret(undo.start, undo.end);
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      onKeyDown?.(event);
      return;
    }
    const currentOptions = optionsRef.current;
    const currentSelection = selectionRef.current;
    const helperVisible = currentOptions.length > 0 && !loadingRef.current;

    if (!helperVisible && event.key === KEY_ESCAPE) {
      if (dismissSuggestionsOnEscape) {
        dismissedWordStartRef.current = matchStartRef.current;
      }
      cancelBlurInsert();
      reset();
    }

    if (helperVisible) {
      const triggerKey =
        localTriggerRef.current !== null
          ? ["Enter", "Tab"].includes(event.key)
            ? { key: event.key }
            : undefined
          : triggerKeyMap.get(event.key);

      if (triggerKey) {
        event.preventDefault();
        handleSelection(
          currentSelection,
          getInsertText(triggerKey, currentOptions[currentSelection]),
          "keyboard",
        );
      } else {
        switch (event.key) {
          case KEY_ESCAPE:
            event.preventDefault();
            // keep the english word that was typed and stop showing
            // suggestions until the next word is started
            if (dismissSuggestionsOnEscape) {
              dismissedWordStartRef.current = matchStartRef.current;
            }
            cancelBlurInsert();
            cancelPendingRequest();
            reset();
            break;
          case KEY_UP:
            event.preventDefault();
            applySelection(
              (currentOptions.length + currentSelection - 1) %
                currentOptions.length,
              true,
            );
            break;
          case KEY_DOWN:
            event.preventDefault();
            applySelection(
              (currentSelection + 1) % currentOptions.length,
              true,
            );
            break;
          default:
            onKeyDown?.(event);
            break;
        }
      }
    } else {
      onKeyDown?.(event);
    }
  };

  const handleBlur = (
    event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (compositionTimeoutRef.current !== null)
      clearTimeout(compositionTimeoutRef.current);
    compositionTimeoutRef.current = null;
    if (loadingRef.current) reset();
    cancelPendingRequest();
    if (!isTouchEnabled()) {
      // read the refs, not the state: a parent escape handler can call
      // `blur()` in the same tick as the reset that this component queued
      const currentSelection = selectionRef.current;

      cancelBlurInsert();

      if (
        insertCurrentSelectionOnBlur &&
        localTriggerRef.current === null &&
        optionsRef.current[currentSelection]
      ) {
        /**
         * An app that closes editors on escape often blurs the input from a
         * capture phase listener, which runs before the keydown reaches this
         * component. The suggestions are still open at that point, so
         * inserting right here would commit a word that escape is about to
         * dismiss. Waiting for the event dispatch to finish lets escape run
         * first, and it clears the options this checks again
         */
        blurInsertTimeoutRef.current = setTimeout(() => {
          blurInsertTimeoutRef.current = null;

          // escape, or anything else, closed the suggestions after the blur
          if (!optionsRef.current[currentSelection]) {
            return;
          }

          // the input took focus back, so the blur no longer stands
          if (document.activeElement === inputRef.current) {
            return;
          }

          handleSelection(currentSelection, DEFAULT_INSERT_TEXT, "blur");
        }, 0);
      } else {
        reset();
      }
    }
    onBlur?.(event);
  };

  const handleResize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    setWindowSize({ width, height });
  };

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const rect = list.getBoundingClientRect();
    // Keep width stable, but let height follow the current result count.
    const size = listSizeRef.current;
    size.width = Math.max(size.width, rect.width);
    size.height = Math.max(rect.height, list.scrollHeight);
    updatePosition();
  }, [options, windowSize, updatePosition]);

  useEffect(() => {
    window.addEventListener("scroll", updatePosition, true);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updatePosition);
    viewport?.addEventListener("scroll", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      viewport?.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("scroll", updatePosition);
    };
  }, [updatePosition]);

  useEffect(() => {
    if (!fetchSuggestions) warmUpTransliteration();
  }, [fetchSuggestions]);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    const width = window.innerWidth;
    const height = window.innerHeight;
    setWindowSize({ width, height });
    setListId(`rt-suggestions-${++instanceCount}`);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelBlurInsert();
      cancelPendingRequest();
      if (caretTimeoutRef.current !== null)
        clearTimeout(caretTimeoutRef.current);
      if (compositionTimeoutRef.current !== null)
        clearTimeout(compositionTimeoutRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      // position relative is required to show the component
      // in the correct position
      style={{
        ...containerStyles,
        position: "relative",
      }}
      className={containerClassName}
    >
      {renderComponent({
        onChange: handleChange,
        onKeyDown: handleKeyDown,
        onBlur: handleBlur,
        onCompositionStart: handleCompositionStart,
        onCompositionEnd: handleCompositionEnd,
        onSelect: handleSelect,
        ref: inputRef,
        value: value,
        role: inputRef.current?.tagName === "TEXTAREA" ? undefined : "combobox",
        "aria-autocomplete": "list",
        "aria-haspopup": "listbox",
        "aria-expanded":
          inputRef.current?.tagName === "TEXTAREA"
            ? undefined
            : shouldRenderSuggestions && options.length > 0,
        "aria-controls": options.length > 0 ? listId : undefined,
        "aria-activedescendant":
          !loading && options.length > 0 ? `${listId}-${selection}` : undefined,
        "data-testid": "rt-input-component",
        ...rest,
      })}
      {shouldRenderSuggestions && options.length > 0 && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={
            localTriggerRef.current === null
              ? "Transliteration suggestions"
              : `Suggestions for ${localTriggerRef.current}`
          }
          style={{
            left: `${left}px`,
            top: `${top}px`,
            position: "absolute",
          }}
          className={[classes.ReactTransliterate, suggestionsClassName]
            .filter(Boolean)
            .join(" ")}
          data-testid="rt-suggestions-list"
          aria-busy={loading}
        >
          {options.map((item, index) => (
            <li
              id={`${listId}-${index}`}
              role="option"
              aria-label={item}
              aria-selected={index === selection}
              aria-disabled={loading}
              className={[
                itemClassName,
                index === selection ? classes.Active : "",
                index === selection ? activeItemClassName : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={
                index === selection
                  ? { backgroundColor: highlightColor, ...activeItemStyles }
                  : {}
              }
              onMouseMove={() => {
                if (!loadingRef.current) applySelection(index, true);
              }}
              onClick={() => handleSelection(index)}
              onMouseDown={(event) => event.preventDefault()}
              key={item}
            >
              <span className={classes.SuggestionText} dir="auto">
                {item}
              </span>
            </li>
          ))}
        </ul>
      )}
      <span
        role="status"
        aria-live="polite"
        className={
          loadingNotice ? classes.LoadingStatus : classes.ScreenReaderOnly
        }
        style={loadingNotice ? { left, top: top - 22 } : undefined}
      >
        {loadingNotice
          ? "Updating suggestions…"
          : !loading && options.length > 0
            ? `${options.length} suggestions available. Use up and down arrows to choose.`
            : ""}
      </span>
    </div>
  );
};

export type {
  ReactTransliterateProps,
  Language,
  TriggerKey,
  TriggerKeyConfig,
  FetchSuggestions,
  SuggestionsResult,
  ValidateSuggestions,
  SuggestionSelection,
  SuggestionsTiming,
  SuggestionTrigger,
  ContentEditableProps,
};
export {
  ContentEditable,
  TriggerKeys,
  PUNCTUATION_TRIGGER_KEYS,
  DEFAULT_TRIGGER_KEYS,
  getFullStopCharacter,
  getApostropheCharacter,
  APOSTROPHE_CHARACTERS,
  getTransliterateSuggestions,
  createAnalyzeSource,
  createAnalyzeValidator,
  clearSuggestionHistory,
};
