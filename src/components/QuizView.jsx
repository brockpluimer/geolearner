// Renders a single question as three slots — stage (the prompt visual), answer
// (choices / typed / map), and feedback — arranged to always fit one screen.
// On wide viewports the answer sits in a side panel next to the stage.
import { useEffect, useRef, useState } from 'react';
import WorldMap from './WorldMap.jsx';
import Flag from './Flag.jsx';
import { checkTyped } from '../lib/quiz.js';

export default function QuizView({ question, answered, result, onAnswer, onNext }) {
  const p = question.prompt;
  const mapAnswer = question.answer.kind === 'map';

  // find-map: the map is the answer and fills the stage; the ask sits on top.
  if (mapAnswer) {
    return (
      <div className="quiz quiz--mapfill">
        <div className="quiz-ask quiz-ask--big">
          <span className="quiz-ask-name">{p.text}</span>
          <span className="quiz-ask-sub">{p.sub}</span>
        </div>
        <div className="quiz-stage">
          <WorldMap
            interactive={!answered}
            focusCca3={answered ? question.target.cca3 : null}
            revealCca3={answered ? question.target.cca3 : null}
            wrongCca3={answered && !result?.correct ? result?.chosenCca3 : null}
            onCountryClick={(country) =>
              !answered &&
              country &&
              onAnswer({
                correct: country.cca3 === question.target.cca3,
                chosenCca3: country.cca3,
              })
            }
          />
        </div>
        <div className="quiz-feedback">
          <Feedback question={question} answered={answered} result={result} onNext={onNext} />
        </div>
      </div>
    );
  }

  // Everything else: a visual stage + an answer panel (choices / typed).
  const ask = p.kind === 'text' ? p.sub : p.text;
  return (
    <div className="quiz quiz--split">
      <div className="quiz-stage">
        <Stage prompt={p} />
      </div>
      <div className="quiz-answer">
        {ask && <p className="quiz-ask">{ask}</p>}
        <AnswerArea question={question} answered={answered} result={result} onAnswer={onAnswer} />
      </div>
      <div className="quiz-feedback">
        <Feedback question={question} answered={answered} result={result} onNext={onNext} />
      </div>
    </div>
  );
}

function Stage({ prompt }) {
  if (prompt.kind === 'map') {
    return (
      <WorldMap
        highlightCca3={prompt.highlightCca3}
        focusCca3={prompt.highlightCca3}
        showCountryLabels
      />
    );
  }
  if (prompt.kind === 'flag') {
    return <Flag code={prompt.cca2} size="w320" className="flag--hero" />;
  }
  return (
    <div className="prompt-textblock">
      <p className="prompt-big">{prompt.text}</p>
    </div>
  );
}

function AnswerArea({ question, answered, result, onAnswer }) {
  if (question.answer.kind === 'typed') {
    return <TypedAnswer question={question} answered={answered} onAnswer={onAnswer} />;
  }
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
        Go
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
  const answerText = question.answer.entity === 'capital' ? target.capital : target.name;
  return (
    <div className={`feedback ${result.correct ? 'feedback--right' : 'feedback--wrong'}`}>
      <div className="feedback-line">
        {result.correct ? (
          <span className="feedback-badge">✓ Correct</span>
        ) : (
          <span className="feedback-badge">
            ✕ It was <strong>{answerText}</strong>
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
