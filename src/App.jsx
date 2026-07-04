// geolearner — a geography quiz that adapts to the countries you miss.
import { useCallback, useEffect, useState } from 'react';
import Menu from './components/Menu.jsx';
import QuizView from './components/QuizView.jsx';
import Scoreboard from './components/Scoreboard.jsx';
import ResultsScreen from './components/ResultsScreen.jsx';
import { MODES, generateQuestion } from './lib/quiz.js';
import { getStats, recordResult, recordStreak } from './lib/storage.js';
import './App.css';

const ROUND_LENGTH = 10;

const emptySession = () => ({
  answered: 0,
  correct: 0,
  streak: 0,
  bestRunStreak: 0,
  history: [],
});

export default function App() {
  const [screen, setScreen] = useState('menu');
  const [modeId, setModeId] = useState('map-name');
  const [region, setRegion] = useState('All');
  const [typed, setTyped] = useState(false);

  const [question, setQuestion] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState(null);

  const [session, setSession] = useState(emptySession);
  const [bestStreak, setBestStreak] = useState(() => getStats().bestStreak);

  const nextQuestion = useCallback(
    (avoidCca3) => {
      setQuestion(generateQuestion({ modeId, region, typed, avoidCca3 }));
      setAnswered(false);
      setResult(null);
    },
    [modeId, region, typed]
  );

  const startQuiz = useCallback(
    (id) => {
      setModeId(id);
      setSession(emptySession());
      setQuestion(generateQuestion({ modeId: id, region, typed }));
      setAnswered(false);
      setResult(null);
      setScreen('quiz');
    },
    [region, typed]
  );

  const handleAnswer = useCallback(
    (res) => {
      if (answered || !question) return;
      setAnswered(true);
      setResult(res);

      recordResult(question.target.cca3, res.correct);
      setSession((s) => {
        const streak = res.correct ? s.streak + 1 : 0;
        return {
          answered: s.answered + 1,
          correct: s.correct + (res.correct ? 1 : 0),
          streak,
          bestRunStreak: Math.max(s.bestRunStreak, streak),
          history: [
            ...s.history,
            {
              cca3: question.target.cca3,
              cca2: question.target.cca2,
              name: question.target.name,
              capital: question.target.capital,
              region: question.target.region,
              correct: res.correct,
            },
          ],
        };
      });

      if (res.correct) {
        setBestStreak((b) => {
          const run = session.streak + 1;
          const nextBest = Math.max(b, run);
          if (nextBest > b) recordStreak(nextBest);
          return nextBest;
        });
      }
    },
    [answered, question, session.streak]
  );

  const handleNext = useCallback(() => {
    if (session.answered >= ROUND_LENGTH) {
      setScreen('results');
      return;
    }
    nextQuestion(question?.target.cca3);
  }, [session.answered, nextQuestion, question]);

  // Keyboard: number keys 1–4 pick MC choices. (Enter is handled natively by the
  // auto-focused "Next" button, so it isn't wired here to avoid double-advancing.)
  useEffect(() => {
    if (screen !== 'quiz' || answered) return;
    const onKey = (e) => {
      if (question?.answer.kind === 'mc' && /^[1-4]$/.test(e.key)) {
        const choice = question.choices[Number(e.key) - 1];
        if (choice) handleAnswer({ correct: choice.correct, chosenCca3: choice.cca3 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, answered, question, handleAnswer]);

  const mode = MODES[modeId];

  return (
    <div className="app">
      {screen === 'menu' && (
        <Menu
          region={region}
          setRegion={setRegion}
          typed={typed}
          setTyped={setTyped}
          onStart={startQuiz}
        />
      )}

      {screen === 'quiz' && question && (
        <div className="quiz-screen">
          <header className="quiz-header">
            <button className="link-btn" onClick={() => setScreen('menu')}>
              ← Menu
            </button>
            <div className="quiz-mode">
              <span className="quiz-mode-label">{mode.label}</span>
              {region !== 'All' && <span className="chip chip--sm">{region}</span>}
              {typed && mode.canType && <span className="chip chip--sm">typed</span>}
            </div>
            <div className="quiz-progress">
              {Math.min(session.answered + (answered ? 0 : 1), ROUND_LENGTH)}/{ROUND_LENGTH}
            </div>
          </header>

          <Scoreboard
            score={session.correct}
            answered={session.answered}
            streak={session.streak}
            bestStreak={bestStreak}
          />

          <div className="progress-bar" aria-hidden="true">
            <span style={{ width: `${(session.answered / ROUND_LENGTH) * 100}%` }} />
          </div>

          <QuizView
            key={question.id}
            question={question}
            answered={answered}
            result={result}
            onAnswer={handleAnswer}
            onNext={handleNext}
          />
        </div>
      )}

      {screen === 'results' && (
        <ResultsScreen
          session={{ ...session, modeLabel: mode.label }}
          onPlayAgain={() => startQuiz(modeId)}
          onMenu={() => setScreen('menu')}
        />
      )}
    </div>
  );
}
