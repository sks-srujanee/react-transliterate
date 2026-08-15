import * as React from "react";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  setCaretPosition,
  getInputSelection,
  isTouchEnabled,
  isLatinText,
} from "./util";
import getCaretCoordinates from "textarea-caret";
import classes from "./styles.module.css";
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
import { getTransliterateSuggestions } from "./util/suggestions-util";

const KEY_UP = "ArrowUp";
const KEY_DOWN = "ArrowDown";
const KEY_ESCAPE = "Escape";

const OPTION_LIST_Y_OFFSET = 10;
const OPTION_LIST_MIN_WIDTH = 100;

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
  containerClassName = "",
  containerStyles = {},
  activeItemStyles = {},
  maxOptions = 5,
  hideSuggestionBoxOnMobileDevices = false,
  hideSuggestionBoxBreakpoint = 450,
  triggerKeys = DEFAULT_TRIGGER_KEYS,
  fullStopCharacter,
  dismissSuggestionsOnEscape = true,
  insertCurrentSelectionOnBlur = true,
  showCurrentWordAsLastSuggestion = true,
  enabled = true,
  ...rest
}: ReactTransliterateProps): React.JSX.Element => {
  const [options, setOptions] = useState<string[]>([]);
  const [left, setLeft] = useState(0);
  const [top, setTop] = useState(0);
  const [selection, setSelection] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
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
  const selectionRef = useRef(0);
  const matchStartRef = useRef(-1);
  const matchEndRef = useRef(-1);

  const applyOptions = (next: string[]) => {
    optionsRef.current = next;
    setOptions(next);
  };

  const applySelection = (next: number) => {
    selectionRef.current = next;
    setSelection(next);
  };

  const applyMatch = (start: number, end: number) => {
    matchStartRef.current = start;
    matchEndRef.current = end;
  };

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
    applySelection(0);
    applyOptions([]);
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

  const handleSelection = (index: number, insertText = DEFAULT_INSERT_TEXT) => {
    const currentString = value;
    const suggestion = optionsRef.current[index];
    const start = matchStartRef.current;
    const end = matchEndRef.current;

    // create a new string with the currently typed word
    // replaced with the word in transliterated language
    const newValue =
      currentString.substring(0, start) +
      suggestion +
      insertText +
      currentString.substring(end + 1, currentString.length);

    // set the position of the caret (cursor) after the inserted text
    setTimeout(() => {
      setCaretPosition(
        inputRef.current!,
        start + suggestion.length + insertText.length,
      );
    }, 1);

    // the word was replaced, so any escape dismissal for it no longer applies
    dismissedWordStartRef.current = null;

    // bubble up event to the parent component
    const e = {
      target: { value: newValue },
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    onChangeText(newValue);
    onChange?.(e);
    reset();
    return inputRef.current?.focus();
  };

  const renderSuggestions = async (lastWord: string) => {
    if (!shouldRenderSuggestions) {
      return;
    }
    // fetch suggestion from api
    // const url = `https://www.google.com/inputtools/request?ime=transliteration_en_${lang}&num=5&cp=0&cs=0&ie=utf-8&oe=utf-8&app=jsapi&text=${lastWord}`;

    const numOptions = showCurrentWordAsLastSuggestion
      ? maxOptions - 1
      : maxOptions;

    const data = await getTransliterateSuggestions(lastWord, {
      numOptions,
      showCurrentWordAsLastSuggestion,
      lang,
    });
    applyOptions(data);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;

    // bubble up event to the parent component
    onChange?.(e);
    onChangeText(value);

    if (!shouldRenderSuggestions) {
      return;
    }

    // get the current index of the cursor
    const caret = getInputSelection(e.target as HTMLInputElement).end;
    const input = inputRef.current;

    if (!input) return;

    const caretPos = getCaretCoordinates(input, caret);

    // search for the last occurence of the space character from
    // the cursor
    const indexOfLastSpace =
      value.lastIndexOf(" ", caret - 1) < value.lastIndexOf("\n", caret - 1)
        ? value.lastIndexOf("\n", caret - 1)
        : value.lastIndexOf(" ", caret - 1);

    // first character of the currently being typed word is
    // one character after the space character
    // index of last character is one before the current position
    // of the caret
    applyMatch(indexOfLastSpace + 1, caret - 1);

    // the caret moved to a different word, so the word that was dismissed
    // with the escape key is no longer being typed
    if (
      dismissedWordStartRef.current !== null &&
      dismissedWordStartRef.current !== indexOfLastSpace + 1
    ) {
      dismissedWordStartRef.current = null;
    }

    const isDismissed = dismissedWordStartRef.current === indexOfLastSpace + 1;

    // currentWord is the word that is being typed
    const currentWord = value.slice(indexOfLastSpace + 1, caret);
    if (currentWord && enabled && !isDismissed) {
      // make an api call to fetch suggestions
      renderSuggestions(currentWord);

      const rect = input.getBoundingClientRect();

      // calculate new left and top of the suggestion list

      // minimum of the caret position in the text input and the
      // width of the text input
      const left = Math.min(
        caretPos.left,
        rect.width - OPTION_LIST_MIN_WIDTH / 2,
      );

      // minimum of the caret position from the top of the input
      // and the height of the input
      const top = Math.min(caretPos.top + OPTION_LIST_Y_OFFSET, rect.height);

      setTop(top);
      setLeft(left);
    } else {
      reset();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const currentOptions = optionsRef.current;
    const currentSelection = selectionRef.current;
    const helperVisible = currentOptions.length > 0;

    if (helperVisible) {
      const triggerKey = triggerKeyMap.get(event.key);

      if (triggerKey) {
        event.preventDefault();
        handleSelection(
          currentSelection,
          getInsertText(triggerKey, currentOptions[currentSelection]),
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
            reset();
            break;
          case KEY_UP:
            event.preventDefault();
            applySelection(
              (currentOptions.length + currentSelection - 1) %
                currentOptions.length,
            );
            break;
          case KEY_DOWN:
            event.preventDefault();
            applySelection((currentSelection + 1) % currentOptions.length);
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
    if (!isTouchEnabled()) {
      // read the refs, not the state: a parent escape handler can call
      // `blur()` in the same tick as the reset that this component queued
      const currentSelection = selectionRef.current;

      if (
        insertCurrentSelectionOnBlur &&
        optionsRef.current[currentSelection]
      ) {
        handleSelection(currentSelection);
      } else {
        reset();
      }
    }
    onBlur?.(event);
  };

  const handleResize = () => {
    // TODO implement the resize function to resize
    // the helper on screen size change
    const width = window.innerWidth;
    const height = window.innerHeight;
    setWindowSize({ width, height });
  };

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    const width = window.innerWidth;
    const height = window.innerHeight;
    setWindowSize({ width, height });

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
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
        ref: inputRef,
        value: value,
        "data-testid": "rt-input-component",
        ...rest,
      })}
      {shouldRenderSuggestions && options.length > 0 && (
        <ul
          style={{
            left: `${left + offsetX}px`,
            top: `${top + offsetY}px`,
            position: "absolute",
            width: "auto",
          }}
          className={classes.ReactTransliterate}
          data-testid="rt-suggestions-list"
        >
          {/*
           * convert to set and back to prevent duplicate list items
           * that might happen while using backspace
           */}
          {Array.from(new Set(options)).map((item, index) => (
            <li
              className={index === selection ? classes.Active : undefined}
              style={index === selection ? activeItemStyles || {} : {}}
              onMouseEnter={() => {
                applySelection(index);
              }}
              onClick={() => handleSelection(index)}
              key={item}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export type { ReactTransliterateProps, Language, TriggerKey, TriggerKeyConfig };
export {
  TriggerKeys,
  PUNCTUATION_TRIGGER_KEYS,
  DEFAULT_TRIGGER_KEYS,
  getFullStopCharacter,
  getTransliterateSuggestions,
};
