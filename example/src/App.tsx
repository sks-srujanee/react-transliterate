import React, { useState } from "react";

// language list for example only
import { languages } from "./languages";

// import component
import {
  ReactTransliterate,
  ContentEditable,
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

// longer than `maxOptions` (7): the first 7 show on `[`, the rest appear as
// more characters are typed, for example `[sp` reaches `[speech_overlap]`
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
      "[prerecorded_speech]",
      "[profanity]",
      "[beep]",
      "[cough]",
      "[laugh]",
      "[breath]",
      "[click]",
      "[crosstalk]",
      "[echo]",
      "[hum]",
      "[inaudible]",
      "[sneeze]",
      "[static]",
      "[speech_overlap]",
      "[unclear]",
      "[whisper]",
    ],
  },
  {
    trigger: "#",
    suggestions: [
      "#ah",
      "#um",
      "#hm",
      "#uh",
      "#er",
      "#oh",
      "#aa",
      "#eh",
      "#hmm",
      "#huh",
      "#mm",
      "#ooh",
    ],
  },
  { trigger: "<", suggestions: ["<non_intended_lang>"] },
];

const Card = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <section className="card">
    <h3>{title}</h3>
    {hint && <p className="hint">{hint}</p>}
    {children}
  </section>
);

const App = () => {
  const [text, setText] = useState("");
  const [lang, setLang] = useState<Language>("hi");

  const shared = {
    value: text,
    onChangeText: setText,
    lang,
    validateSuggestions,
    suggestionTriggers,
  };

  return (
    <div className="container">
      <header>
        <h2>React transliterate</h2>
        <select
          className="language-dropdown"
          aria-label="Language"
          value={lang}
          onChange={(e) => setLang(e.target.value as Language)}
        >
          {languages.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        
      </header>

      <Card title="Rich editor (contentEditable)" hint="Multi-line, grows with content.">
        <ReactTransliterate
          {...shared}
          renderComponent={(props) => (
            <ContentEditable {...props} className="editor" />
          )}
          placeholder="Start typing here..."
          aria-label="contentEditable editor"
          id="react-transliterate-contenteditable"
        />
      </Card>

      <Card title="Using input">
        <ReactTransliterate
          {...shared}
          placeholder="Start typing here..."
          id="react-transliterate-input"
        />
      </Card>

      <Card title="Using textarea">
        <ReactTransliterate
          {...shared}
          renderComponent={(props) => <textarea {...props} />}
          placeholder="Start typing here..."
          id="react-transliterate-textarea"
        />
      </Card>

      <Card title="Using Material UI input">
        <ReactTransliterate
          {...shared}
          renderComponent={(props) => {
            const inputRef = props.ref;

            delete props["ref"];

            return <Input fullWidth {...props} inputRef={inputRef} />;
          }}
          placeholder="Start typing here..."
          id="react-transliterate-material-ui-input"
        />
      </Card>

      <Card title="Live value">
        <pre className="preview">{text || "Nothing typed yet"}</pre>
      </Card>
    </div>
  );
};

export default App;
