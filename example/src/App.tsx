import React, { useState } from "react";

// language list for example only
import { languages } from "./languages";

// import component
import {
  ReactTransliterate,
  Language,
  createAnalyzeValidator,
} from "@sarthak1407/react-transliterate";

// Material Ui input component
import Input from "@mui/material/Input";

// the analyze endpoint throws out suggestions it cannot parse, such as
// `ेवेरय` for "every". Set VITE_ANALYZE_URL to switch it on, see .env.example
const analyzeUrl = import.meta.env.VITE_ANALYZE_URL;

const validateSuggestions = analyzeUrl
  ? createAnalyzeValidator({ url: analyzeUrl })
  : undefined;

const suggestionTriggers = [
  {
    trigger: "[",
    suggestions: [
      "[human_voice]",
      "[overlap]",
      "[non_human_noise]",
      "[silence]",
      "[bgspeech]",
      "[music]",
      "[noise]",
      "[sarthak]",
      "[prerecorded_speech]",
      "[profanity]",
      "[beep]",
    ],
  },
  { trigger: "#", suggestions: ["#ah", "#um", "#hm", "#uh", "#er", "#oh"] },
  { trigger: "<", suggestions: ["<non_intended_lang>"] },
];

const App = () => {
  const [text, setText] = useState("");

  const [lang, setLang] = useState<Language>("hi");

  return (
    <div className="container">
      <h2>React transliterate</h2>

      <select
        className="language-dropdown"
        value={lang}
        onChange={(e) => setLang(e.target.value as Language)}
      >
        {languages.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>

      <div className="spacer" />

      <label htmlFor="react-transliterate-input">Using input</label>
      <ReactTransliterate
        value={text}
        onChangeText={(text) => {
          setText(text);
        }}
        lang={lang}
        validateSuggestions={validateSuggestions}
        suggestionTriggers={suggestionTriggers}
        placeholder="Start typing here..."
        id="react-transliterate-input"
      />

      <div className="spacer" />

      <label htmlFor="react-transliterate-textarea">Using textarea</label>
      <ReactTransliterate
        renderComponent={(props) => <textarea {...props} />}
        value={text}
        onChangeText={(text) => {
          setText(text);
        }}
        lang={lang}
        validateSuggestions={validateSuggestions}
        suggestionTriggers={suggestionTriggers}
        placeholder="Start typing here..."
        id="react-transliterate-textarea"
      />

      <div className="spacer" />

      <label htmlFor="react-transliterate-material-ui-input">
        Using Material UI input
      </label>
      <ReactTransliterate
        renderComponent={(props) => {
          const inputRef = props.ref;

          delete props["ref"];

          return <Input fullWidth {...props} inputRef={inputRef} />;
        }}
        value={text}
        onChangeText={(text) => {
          setText(text);
        }}
        lang={lang}
        validateSuggestions={validateSuggestions}
        suggestionTriggers={suggestionTriggers}
        placeholder="Start typing here..."
        id="react-transliterate-material-ui-input"
      />
    </div>
  );
};

export default App;
