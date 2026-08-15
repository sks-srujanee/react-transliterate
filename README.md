<h1 align="center">React Transliterate</h1>

Transliteration component for React with support for over 30 languages. Uses API from [Google Input Tools](https://www.google.com/inputtools)

Fork of [burhanuday/react-transliterate](https://github.com/burhanuday/react-transliterate), with configurable trigger keys, punctuation handling and sticky escape.

[![NPM](https://img.shields.io/npm/v/@sarthak1407/react-transliterate.svg)](https://www.npmjs.com/package/@sarthak1407/react-transliterate)

<p align="center">
<img src="./assets/hi.gif"></img>
</p>

## Demo

[See Demo](https://sks-srujanee.github.io/react-transliterate/)

## Install

```bash
npm install --save @sarthak1407/react-transliterate

OR

yarn add @sarthak1407/react-transliterate
```

## Usage

### Basic example

```jsx
import React, { useState } from "react";

import { ReactTransliterate } from "@sarthak1407/react-transliterate";
import "@sarthak1407/react-transliterate/dist/index.css";

const App = () => {
  const [text, setText] = useState("");

  return (
    <ReactTransliterate
      value={text}
      onChangeText={(text) => {
        setText(text);
      }}
      lang="hi"
    />
  );
};

export default App;
```

### With custom component

```jsx
import React, { useState } from "react";

import { ReactTransliterate } from "@sarthak1407/react-transliterate";
import "@sarthak1407/react-transliterate/dist/index.css";

const App = () => {
  const [text, setText] = useState("");

  return (
    <ReactTransliterate
      renderComponent={(props) => <textarea {...props} />}
      value={text}
      onChangeText={(text) => {
        setText(text);
      }}
      lang="hi"
    />
  );
};

export default App;
```

### Usage with TypeScript

```tsx
import React, { useState } from "react";

import { ReactTransliterate, Language } from "@sarthak1407/react-transliterate";
import "@sarthak1407/react-transliterate/dist/index.css";

const App = () => {
  const [text, setText] = useState("");
  const [lang, setLang] = useState<Language>("hi");

  return (
    <ReactTransliterate
      renderComponent={(props) => <textarea {...props} />}
      value={text}
      onChangeText={(text) => {
        setText(text);
      }}
      lang={lang}
    />
  );
};

export default App;
```

### With material ui

```tsx
import React, { useState } from "react";

import { ReactTransliterate, Language } from "@sarthak1407/react-transliterate";
import "@sarthak1407/react-transliterate/dist/index.css";

import Input from "@material-ui/core/Input";

const App = () => {
  const [text, setText] = useState("");
  const [lang, setLang] = useState<Language>("hi");

  return (
    <ReactTransliterate
      renderComponent={(props) => {
        const inputRef = props.ref;
        delete props["ref"];
        return <Input {...props} inputRef={inputRef} />;
      }}
      value={text}
      onChangeText={(text) => {
        setText(text);
      }}
      lang={lang}
    />
  );
};

export default App;
```

### Custom trigger keys

Keys which when pressed, input the current selection to the textbox.

By default:

| Key                 | Inserted after the suggestion                                     |
| ------------------- | ----------------------------------------------------------------- |
| Space               | a space                                                            |
| Enter               | nothing                                                            |
| Tab                 | nothing                                                            |
| Full stop           | the sentence terminator and a space, eg. `।` for `hi`, `.` for `ta` |
| `?` `!` `,` `;` `:` | the punctuation followed by a space                                |

The full stop key follows the suggestion that is being inserted, not only the
language. Committing `नमस्ते` in `hi` gives `नमस्ते। `, while committing the english
word that was typed gives `sarthak. `

Pass `triggerKeys` to change this. An entry is either the key itself
(`event.key`) or an object with the text to insert after the suggestion:

```jsx
import React, { useState } from "react";

import {
  ReactTransliterate,
  TriggerKeys,
  PUNCTUATION_TRIGGER_KEYS,
} from "@sarthak1407/react-transliterate";
import "@sarthak1407/react-transliterate/dist/index.css";

const App = () => {
  const [text, setText] = useState("");

  return (
    <ReactTransliterate
      value={text}
      onChangeText={(text) => {
        setText(text);
      }}
      lang="hi"
      triggerKeys={[
        // insert the suggestion followed by a space
        { key: TriggerKeys.KEY_SPACE, insertText: " " },
        // insert the suggestion with nothing after it
        { key: TriggerKeys.KEY_ENTER, insertText: "" },
        // insert `।` after the suggestion for hi, `.` for languages
        // that do not use a purnaviram, then a space
        {
          key: TriggerKeys.KEY_FULL_STOP,
          insertText: ({ fullStopCharacter }) => `${fullStopCharacter} `,
        },
        // a plain string is the same as `{ key, insertText: " " }`
        TriggerKeys.KEY_TAB,
        // punctuation, inserted after the suggestion and followed by a space
        ...PUNCTUATION_TRIGGER_KEYS.map((key) => ({
          key,
          insertText: ({ key: pressedKey }) => `${pressedKey} `,
        })),
        // any other key works too
        { key: "-", insertText: "-" },
      ]}
    />
  );
};

export default App;
```

`insertText` can be a function, which receives
`{ key, suggestion, lang, fullStopCharacter, value, matchStart, matchEnd }`
and returns the text to insert.

The sentence terminator used by the full stop key comes from `lang`. Override
it with the `fullStopCharacter` prop, or read it yourself with
`getFullStopCharacter(lang)`.

### Dismissing suggestions

Pressing `Escape` closes the suggestion box and keeps the english word that was
typed. Suggestions stay hidden for that word until a new word is started. Set
`dismissSuggestionsOnEscape={false}` to have the box reopen on the next
keystroke instead.

## Get transliteration suggestions

```jsx
import { getTransliterateSuggestions } from "@sarthak1407/react-transliterate";

const data = await getTransliterateSuggestions(
  word, // word to fetch suggestions for
  {
    numOptions: 5, // number of suggestions to fetch
    showCurrentWordAsLastSuggestion: true, // add the word as the last suggestion
    lang: "hi", // target language
  },
);
```

For a full example, take a look at the `example` folder

### Props

| Prop                             | Required? | Default                                     | Description                                                                                                                          |
| -------------------------------- | --------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| onChangeText                     | Yes       |                                             | Listener for the current value from the component. `(text: string) => void`                                                          |
| value                            | Yes       |                                             | `value` prop to pass to the component                                                                                                |
| enabled                          |           | true                                        | Control whether suggestions should be shown                                                                                          |
| renderComponent                  |           | `(props) => <input {...props} />`           | Component to render. You can pass components from your component library as this prop                                                |
| lang                             |           | hi                                          | Language you want to transliterate. See the following section for language codes                                                     |
| maxOptions                       |           | 5                                           | Maximum number of suggestions to show in helper                                                                                      |
| offsetY                          |           | 0                                           | Extra space between the top of the helper and bottom of the caret                                                                    |
| offsetX                          |           | 0                                           | Extra space between the caret and left of the helper                                                                                 |
| containerClassName               |           | empty string                                | Classname passed to the container of the component                                                                                   |
| containerStyles                  |           | {}                                          | CSS styles object passed to the container                                                                                            |
| activeItemStyles                 |           | {}                                          | CSS styles object passed to the active item `<li>` tag                                                                               |
| hideSuggestionBoxOnMobileDevices |           | `false`                                     | Should the suggestions be visible on mobile devices since keyboards like Gboard and Swiftkey support typing in multiple languages    |
| hideSuggestionBoxBreakpoint      |           | 450                                         | type: `number`. To be used when `hideSuggestionBoxOnMobileDevices` is true. Suggestion box will not be shown below this device width |
| triggerKeys                      |           | `KEY_SPACE, KEY_ENTER, KEY_TAB, KEY_FULL_STOP` and `PUNCTUATION_TRIGGER_KEYS` | Keys which when pressed, input the current selection to the textbox. Each entry is a key or `{ key, insertText }` |
| fullStopCharacter                |           | terminator of `lang`, eg. `।` for `hi`      | Character inserted by the full stop trigger key. Ignored when the selected suggestion is the english word, which always takes `.`     |
| dismissSuggestionsOnEscape       |           | `true`                                      | `Escape` keeps the typed english word and hides suggestions until the next word                                                      |
| insertCurrentSelectionOnBlur     |           | `true`                                      | Should the current selection be inserted when `blur` event occurs                                                                    |
| showCurrentWordAsLastSuggestion  |           | `true`                                      | Show current input as the last option in the suggestion box                                                                          |

### Supported Languages

| Language              | Code     |
| --------------------- | -------- |
| Amharic               | am       |
| Arabic                | ar       |
| Bangla                | bn       |
| Belarusian            | be       |
| Bulgarian             | bg       |
| Chinese (Hong Kong)   | yue-hant |
| Chinese (Simplified)  | zh       |
| Chinese (Traditional) | zh-hant  |
| French                | fr       |
| German                | de       |
| Greek                 | el       |
| Gujarati              | gu       |
| Hebrew                | he       |
| Hindi                 | hi       |
| Italian               | it       |
| Japanese              | ja       |
| Kannada               | kn       |
| Malayalam             | ml       |
| Marathi               | mr       |
| Nepali                | ne       |
| Odia                  | or       |
| Persian               | fa       |
| Portuguese (Brazil)   | pt       |
| Punjabi               | pa       |
| Russian               | ru       |
| Sanskrit              | sa       |
| Serbian               | sr       |
| Sinhala               | si       |
| Spanish               | es       |
| Tamil                 | ta       |
| Telugu                | te       |
| Tigrinya              | ti       |
| Ukrainian             | uk       |
| Urdu                  | ur       |
| Vietnamese            | vi       |

## License

MIT © [burhanuday](https://github.com/burhanuday), fork maintained by [sks-srujanee](https://github.com/sks-srujanee)
