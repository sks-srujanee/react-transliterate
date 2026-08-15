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

The component injects its own styles, so there is nothing to import. The same
stylesheet is still published as `@sarthak1407/react-transliterate/dist/index.css`
if you would rather load it through your own pipeline or override it.

### Basic example

```jsx
import React, { useState } from "react";

import { ReactTransliterate } from "@sarthak1407/react-transliterate";

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

| Key                 | Inserted after the suggestion                                       |
| ------------------- | ------------------------------------------------------------------- |
| Space               | a space                                                             |
| Enter               | nothing                                                             |
| Tab                 | nothing                                                             |
| Full stop           | the sentence terminator and a space, eg. `।` for `hi`, `.` for `ta` |
| `?` `!` `,` `;` `:` | the punctuation followed by a space                                 |

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

### Theming

Every visual value is a css custom property, so a theme is a plain object of
tokens. Anything left out keeps the default.

```jsx
<ReactTransliterate
  value={text}
  onChangeText={setText}
  lang="hi"
  theme={{
    background: "#16161a",
    color: "#e8e8ef",
    activeBackground: "#f9c80e",
    activeColor: "#16161a",
    border: "1px solid #2a2a33",
    borderRadius: "8px",
    boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
    fontSize: "15px",
    maxHeight: "240px",
  }}
/>
```

| Token                                    | Custom property                               | Default                       |
| ---------------------------------------- | --------------------------------------------- | ----------------------------- |
| `background`                             | `--rt-background`                             | `#fff`                        |
| `color`                                  | `--rt-color`                                  | `inherit`                     |
| `activeBackground`                       | `--rt-active-background`                      | `#65c3d7`                     |
| `activeColor`                            | `--rt-active-color`                           | `#fff`                        |
| `border`                                 | `--rt-border`                                 | `1px solid rgba(0,0,0,.15)`   |
| `borderRadius`                           | `--rt-border-radius`                          | `0`                           |
| `boxShadow`                              | `--rt-box-shadow`                             | `0 6px 12px rgba(0,0,0,.175)` |
| `fontFamily` / `fontSize`                | `--rt-font-family` / `--rt-font-size`         | `inherit` / `14px`            |
| `itemPaddingBlock` / `itemPaddingInline` | `--rt-item-padding-*`                         | `10px`                        |
| `minWidth` / `maxWidth` / `maxHeight`    | `--rt-min-width` / `-max-width`/`-max-height` | `100px` / `320px` / `none`    |
| `zIndex`                                 | `--rt-z-index`                                | `20000`                       |

Because they are custom properties, a stylesheet works just as well, which is
the way to theme by media query:

```css
@media (prefers-color-scheme: dark) {
  .my-suggestions {
    --rt-background: #16161a;
    --rt-active-background: #f9c80e;
  }
}
```

Pass `suggestionsClassName`, `itemClassName` and `activeItemClassName` to hang
your own classes on the list and its items.

### Custom suggestion source

`fetchSuggestions` replaces Google Input Tools with any endpoint. It receives
the word being typed plus the language, the full input value, the bounds of the
word and an `AbortSignal` that fires when the word changes.

```jsx
<ReactTransliterate
  value={text}
  onChangeText={setText}
  lang="hi"
  fetchSuggestions={async (word, { lang, signal }) => {
    const res = await fetch("https://example.com/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, lang }),
      signal,
    });
    const data = await res.json();
    return data.suggestions;
  }}
  onSuggestionsError={(error) => console.error(error)}
  debounceMs={150}
  minWordLength={2}
/>
```

`createAnalyzeSource` is a ready made source for an `/analyze` endpoint that
takes `{ sentence, language }` and answers with per word `spell_suggestions`
and `codemix_options`:

```jsx
import {
  ReactTransliterate,
  createAnalyzeSource,
} from "@sarthak1407/react-transliterate";

const analyze = createAnalyzeSource({
  url: "https://labs-prod.srujanee.in/v1/analyze",
  // "spell" for corrections, "codemix" for the latin spellings, or "both"
  use: "both",
  // drop spelling suggestions the endpoint is unsure about
  minConfidence: 0.6,
  // send the whole input for context instead of the word alone
  sendFullSentence: false,
  headers: { Authorization: `Bearer ${token}` },
});

<ReactTransliterate
  value={text}
  onChangeText={setText}
  lang="hi"
  fetchSuggestions={analyze}
/>;
```

Spelling suggestions come first, ordered by confidence, followed by the codemix
options, with the typed word removed since the component appends it itself when
`showCurrentWordAsLastSuggestion` is on.

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

| Prop                             | Required? | Default                                                                       | Description                                                                                                                          |
| -------------------------------- | --------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| onChangeText                     | Yes       |                                                                               | Listener for the current value from the component. `(text: string) => void`                                                          |
| value                            | Yes       |                                                                               | `value` prop to pass to the component                                                                                                |
| enabled                          |           | true                                                                          | Control whether suggestions should be shown                                                                                          |
| renderComponent                  |           | `(props) => <input {...props} />`                                             | Component to render. You can pass components from your component library as this prop                                                |
| lang                             |           | hi                                                                            | Language you want to transliterate. See the following section for language codes                                                     |
| maxOptions                       |           | 5                                                                             | Maximum number of suggestions to show in helper                                                                                      |
| offsetY                          |           | 0                                                                             | Extra space between the top of the helper and bottom of the caret                                                                    |
| offsetX                          |           | 0                                                                             | Extra space between the caret and left of the helper                                                                                 |
| containerClassName               |           | empty string                                                                  | Classname passed to the container of the component                                                                                   |
| containerStyles                  |           | {}                                                                            | CSS styles object passed to the container                                                                                            |
| activeItemStyles                 |           | {}                                                                            | CSS styles object passed to the active item `<li>` tag                                                                               |
| hideSuggestionBoxOnMobileDevices |           | `false`                                                                       | Should the suggestions be visible on mobile devices since keyboards like Gboard and Swiftkey support typing in multiple languages    |
| hideSuggestionBoxBreakpoint      |           | 450                                                                           | type: `number`. To be used when `hideSuggestionBoxOnMobileDevices` is true. Suggestion box will not be shown below this device width |
| triggerKeys                      |           | `KEY_SPACE, KEY_ENTER, KEY_TAB, KEY_FULL_STOP` and `PUNCTUATION_TRIGGER_KEYS` | Keys which when pressed, input the current selection to the textbox. Each entry is a key or `{ key, insertText }`                    |
| fullStopCharacter                |           | terminator of `lang`, eg. `।` for `hi`                                        | Character inserted by the full stop trigger key. Ignored when the selected suggestion is the english word, which always takes `.`    |
| dismissSuggestionsOnEscape       |           | `true`                                                                        | `Escape` keeps the typed english word and hides suggestions until the next word                                                      |
| insertCurrentSelectionOnBlur     |           | `true`                                                                        | Should the current selection be inserted when `blur` event occurs                                                                    |
| showCurrentWordAsLastSuggestion  |           | `true`                                                                        | Show current input as the last option in the suggestion box                                                                          |

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

## Development

Requires node 20 or newer, node 24 is what the repo is pinned to in `.nvmrc`

```bash
nvm use            # node 24
yarn install       # builds the library through the prepare script

yarn test          # unit tests, lint and a production build
yarn test:unit     # vitest
yarn test:watch    # vitest in watch mode

yarn start         # rebuild the library on change
cd example && yarn install && yarn dev   # example app on localhost:3000
```

The library is built with Vite in library mode, types come from `tsc`, tests run
on Vitest with jsdom, and the example app is a Vite React app.

## License

MIT © [burhanuday](https://github.com/burhanuday), fork maintained by [sks-srujanee](https://github.com/sks-srujanee)
