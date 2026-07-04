// Renders a single question: a prompt (map / flag / text) and an answer area
// (multiple choice / typed / click-the-map). Reports results up to App.
import { useEffect, useRef, useState } from 'react';
import WorldMap from './WorldMap.jsx';
import Flag from './Flag.jsx';
import { checkTyped } from '../lib/quiz.js';

export default function QuizView({ question, answered, result, onAnswer, onNext }) {
  return (
    <div className="quiz">
      <Prompt question={question} answered={answered} result={result} />
      <AnswerArea question={question} answered={answered} result={result} onAnswer={onAnswer} />
      <Feedback question={question} answered={answered} result={result} onNext={onNext} />
    </div>
  );
}

function Prompt({ question, answered, result }) {
  const { prompt } = question;
  if (prompt.kind === 'map') {
    return (
      <div className="prompt prompt--map">
        <p className="prompt-question">{prompt.text}</p>
        <WorldMap highlightCca3={prompt.highlightCca3} focusCca3={prompt.highlightCca3} />
      </div>
    );
  }
  if (prompt.kind === 'flag') {
    return (
      <div className="prompt prompt--flag">
        <p className="prompt-question">{prompt.text}</p>
        <Flag code={prompt.cca2} size="w320" className="flag--hero" />
      </div>
    );
  }
  // text prompt (country→capital, capital→country, find-map)
  return (
    <div className="prompt prompt--text">
      <p className="prompt-big">{prompt.text}</p>
      {prompt.sub && <p className="prompt-sub">{prompt.sub}</p>}
    </div>
  );
}

function AnswerArea({ question, answered, result, onAnswer }) {
  if (question.answer.kind === 'mc') {
    return (
      <div className="choices">
        {question.choices.map((c) => (
          <button
            key={c.id}
            className={`choice${answered ? choiceState(c, result) : ''}`}
            disabled={answered}
            onClick={() => onAnswer({ correct: c.correct, chosenCca3: c.cca3 })}
          >
            {c.label}
          </button>
        ))}
      </div>
    );
  }
  if (question.answer.kind === 'typed') {
    return <TypedAnswer question={question} answered={answered} onAnswer={onAnswer} />;
  }
  // map click (spatial)
  return (
    <div className="answer-map">
      <WorldMap
        interactive={!answered}
        focusCca3={answered ? question.target.cca3 : null}
        revealCca3={answered ? question.target.cca3 : null}
        wrongCca3={answered && !result?.correct ? result?.chosenCca3 : null}
        onCountryClick={(country) =>
          !answered &&
          country &&
          onAnswer({ correct: country.cca3 === question.target.cca3, chosenCca3: country.cca3 })
        }
      />
    </div>
  );
}

function TypedAnswer({ question, answered, onAnswer }) {
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setValue('');
    inputRef.current?.focus();
  }, [question.id]);

  const submit = (e) => {
    e.preventDefault();
    if (answered || !value.trim()) return;
    onAnswer({ correct: checkTyped(question, value), chosenCca3: question.target.cca3, typed: value });
  };

  return (
    <form className="typed" onSubmit={submit}>
      <input
        ref={inputRef}
        className="typed-input"
        type="text"
        value={value}
        disabled={answered}
        placeholder={question.answer.entity === 'capital' ? 'Type the capital…' : 'Type the country…'}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        aria-label="Your answer"
      />
      <button className="btn btn--primary" type="submit" disabled={answered || !value.trim()}>
        Submit
      </button>
    </form>
  );
}

function Feedback({ question, answered, result, onNext }) {
  const nextRef = useRef(null);
  useEffect(() => {
    if (answered) nextRef.current?.focus();
  }, [answered]);
  if (!answered) return <div className="feedback feedback--placeholder" />;

  const target = question.target;
  const answerText =
    question.answer.entity === 'capital' ? target.capital : target.name;
  return (
    <div className={`feedback ${result.correct ? 'feedback--right' : 'feedback--wrong'}`}>
      <div className="feedback-line">
        {result.correct ? (
          <span className="feedback-badge">✓ Correct</span>
        ) : (
          <span className="feedback-badge">
            ✗ It was <strong>{answerText}</strong>
          </span>
        )}
        <span className="feedback-detail">
          <Flag code={target.cca2} size="w160" className="flag--inline" /> {target.name} ·{' '}
          {target.capital} · {target.region}
        </span>
      </div>
      <button ref={nextRef} className="btn btn--primary btn--next" onClick={onNext}>
        Next →
      </button>
    </div>
  );
}

function choiceState(choice, result) {
  if (choice.correct) return ' choice--correct';
  if (result && choice.cca3 === result.chosenCca3) return ' choice--wrong';
  return ' choice--muted';
}
