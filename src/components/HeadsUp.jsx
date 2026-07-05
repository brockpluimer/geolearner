// Heads Up — hold the phone to your forehead, the room gives clues, and you
// tilt to score. Fullscreen, self-contained party mode.
//
// Input model (see the design notes in the round view):
//   • Tilt the screen DOWN (toward the floor) = correct → next card
//   • Tilt the screen UP   (toward the ceiling) = pass  → next card
// Tilt reads the device's gravity vector via `devicemotion`, which is
// orientation-independent, so portrait or landscape both work. Everywhere the
// sensor is missing or denied (desktop, iOS permission declined) the same two
// actions are driven by tap zones and the arrow/space keys.
import { useCallback, useEffect, useRef, useState } from 'react';
import Flag from './Flag.jsx';
import LocatorMap from './LocatorMap.jsx';
import { HEADSUP_DECKS, DECK_LIST, buildDeck } from '../lib/headsup.js';

const ROUND_SECONDS = 60;
const FLASH_MS = 620; // how long the correct/pass color-flash holds a card
// Tilt uses the screen-normal axis of the gravity vector (~9.8 at full tilt, ~0
// when the phone is upright against the forehead). We low-pass filter it so the
// jerk of the motion itself can't spike a false trigger or flip the direction.
const TILT_ALPHA = 0.85; // smoothing: higher = steadier but slower to respond
const TILT_TRIGGER = 7; // filtered magnitude that fires an action (~45° tilt)
const TILT_NEUTRAL = 2.5; // must settle back within this before the next trigger
const TILT_HOLD_MS = 200; // tilt must be *held* this long — kills accidental flicks
const TILT_COOLDOWN = 650; // ms lockout after a trigger, belt-and-suspenders

/** Ask for motion access (iOS 13+). Returns true if tilt input is usable. */
async function requestMotion() {
  const D = typeof window !== 'undefined' ? window.DeviceMotionEvent : undefined;
  if (!D) return false;
  if (typeof D.requestPermission === 'function') {
    try {
      return (await D.requestPermission()) === 'granted';
    } catch {
      return false;
    }
  }
  return true; // sensor present, no explicit permission required
}

export default function HeadsUp({ region = 'All', onExit }) {
  const [phase, setPhase] = useState('setup'); // setup | countdown | play | done
  const [deckId, setDeckId] = useState('countries');
  const [tiltOn, setTiltOn] = useState(false);

  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState([]); // { country, hit }
  const [flash, setFlash] = useState(null); // 'correct' | 'pass' | null
  const [count, setCount] = useState(3); // 3-2-1-GO countdown
  const [secondsLeft, setSecondsLeft] = useState(ROUND_SECONDS);

  // Refs so the motion/keyboard/timer handlers always see live values.
  const queueRef = useRef(queue);
  const indexRef = useRef(index);
  const lockRef = useRef(false);
  queueRef.current = queue;
  indexRef.current = index;

  const deck = HEADSUP_DECKS[deckId];

  // --- Advancing -------------------------------------------------------------
  const advance = useCallback((hit) => {
    if (lockRef.current) return;
    const i = indexRef.current;
    const country = queueRef.current[i];
    if (!country) return;
    lockRef.current = true;
    setResults((r) => [...r, { country, hit }]);
    setFlash(hit ? 'correct' : 'pass');
    window.setTimeout(() => {
      setFlash(null);
      lockRef.current = false;
      setIndex((n) => n + 1);
    }, FLASH_MS);
  }, []);
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // Ran out of cards mid-round (rare): end early.
  useEffect(() => {
    if (phase === 'play' && index >= queue.length && queue.length > 0) setPhase('done');
  }, [phase, index, queue.length]);

  // --- Start / countdown -----------------------------------------------------
  const start = useCallback(async () => {
    const ok = await requestMotion();
    setTiltOn(ok);
    setQueue(buildDeck({ deck: deckId, region }));
    setIndex(0);
    setResults([]);
    setFlash(null);
    setCount(3);
    setSecondsLeft(ROUND_SECONDS);
    lockRef.current = false;
    setPhase('countdown');
  }, [deckId, region]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count <= 0) {
      setPhase('play');
      return;
    }
    const t = window.setTimeout(() => setCount((c) => c - 1), 800);
    return () => window.clearTimeout(t);
  }, [phase, count]);

  // --- Round timer -----------------------------------------------------------
  useEffect(() => {
    if (phase !== 'play') return;
    const end = Date.now() + ROUND_SECONDS * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) setPhase('done');
    };
    tick();
    const iv = window.setInterval(tick, 200);
    return () => window.clearInterval(iv);
  }, [phase]);

  // --- Tilt input ------------------------------------------------------------
  useEffect(() => {
    if (phase !== 'play' || !tiltOn) return;
    let gz = null; // low-pass-filtered gravity on the screen-normal axis
    let armed = false; // require a settle-to-upright before the next trigger
    let lastFire = 0;
    let pendingDir = 0; // direction currently past threshold (+1 down / -1 up)
    let pendingSince = 0; // when it first crossed — must hold TILT_HOLD_MS to fire
    const onMotion = (e) => {
      const z = e.accelerationIncludingGravity?.z;
      if (z == null) return;
      gz = gz == null ? z : TILT_ALPHA * gz + (1 - TILT_ALPHA) * z;
      const now = Date.now();
      if (!armed) {
        if (Math.abs(gz) < TILT_NEUTRAL) armed = true;
        return;
      }
      if (now - lastFire < TILT_COOLDOWN) return;
      // Which way are we tilted past the trigger? 0 = still roughly upright.
      const dir = gz < -TILT_TRIGGER ? 1 : gz > TILT_TRIGGER ? -1 : 0;
      if (dir === 0 || dir !== pendingDir) {
        pendingDir = dir;
        pendingSince = now;
        return;
      }
      // Same direction held long enough — commit it.
      if (now - pendingSince >= TILT_HOLD_MS) {
        armed = false;
        pendingDir = 0;
        lastFire = now;
        advanceRef.current(dir === 1); // down toward floor = got it
      }
    };
    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [phase, tiltOn]);

  // --- Keyboard (desktop) ----------------------------------------------------
  useEffect(() => {
    if (phase !== 'play') return;
    const onKey = (e) => {
      if (e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        advanceRef.current(true);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        advanceRef.current(false);
      } else if (e.key === 'Escape') {
        setPhase('done');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const hits = results.filter((r) => r.hit).length;

  // --- Render ----------------------------------------------------------------
  if (phase === 'setup') {
    return (
      <div className="headsup headsup--setup">
        <button className="link-btn headsup-back" onClick={onExit}>
          ← Menu
        </button>
        <div className="headsup-setup-inner">
          <h1 className="headsup-title">Heads Up</h1>
          <p className="headsup-lede">
            Hold the phone to your forehead. The room gives clues. Tilt{' '}
            <strong>down</strong> when you get it, <strong>up</strong> to pass. 60 seconds —
            how many can you get?
          </p>

          <p className="headsup-fieldlabel">Pick a deck</p>
          <div className="headsup-decks">
            {DECK_LIST.map((d) => (
              <button
                key={d.id}
                className={`headsup-deck${d.id === deckId ? ' is-active' : ''}`}
                onClick={() => setDeckId(d.id)}
              >
                <span className="headsup-deck-icon" aria-hidden="true">
                  {d.icon}
                </span>
                <span className="headsup-deck-label">{d.label}</span>
                <span className="headsup-deck-blurb">{d.blurb}</span>
              </button>
            ))}
          </div>

          {region !== 'All' && <p className="headsup-region">Region: {region}</p>}

          <button className="btn btn--primary headsup-start" onClick={start}>
            Start round
          </button>
          <p className="headsup-note">
            On phones you may be asked to allow motion access for tilt. No sensor? Tap the
            bottom of the screen for a hit, the top to pass.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'countdown') {
    return (
      <div className="headsup headsup--countdown">
        <p className="headsup-getready">Phone to your forehead…</p>
        <div className="headsup-count" key={count}>
          {count > 0 ? count : 'GO'}
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="headsup headsup--done">
        <div className="headsup-done-inner">
          <p className="headsup-fieldlabel">{deck.label} · time!</p>
          <div className="headsup-score">
            <strong>{hits}</strong>
            <span>correct</span>
          </div>
          <ul className="headsup-recap">
            {results.map((r, i) => (
              <li key={i} className={r.hit ? 'is-hit' : 'is-miss'}>
                <span className="headsup-recap-mark" aria-hidden="true">
                  {r.hit ? '✓' : '→'}
                </span>
                <Flag code={r.country.cca2} size="w160" className="headsup-recap-flag" />
                <span className="headsup-recap-name">
                  {deckId === 'capitals' ? r.country.capital : r.country.name}
                </span>
              </li>
            ))}
            {results.length === 0 && <li className="headsup-recap-empty">No cards this round.</li>}
          </ul>
          <div className="headsup-done-actions">
            <button className="btn btn--primary" onClick={start}>
              Play again
            </button>
            <button className="btn btn--ghost" onClick={() => setPhase('setup')}>
              Change deck
            </button>
            <button className="link-btn" onClick={onExit}>
              Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === 'play'
  const country = queue[index];
  return (
    <div className={`headsup headsup--play${flash ? ` headsup--flash-${flash}` : ''}`}>
      <div className="headsup-hud">
        <span className="headsup-timer">{secondsLeft}</span>
        <span className="headsup-tally">{hits}</span>
      </div>

      {country && (
        <div className="headsup-card">
          <Card deckId={deckId} country={country} />
        </div>
      )}

      {flash && (
        <div className="headsup-flashword">{flash === 'correct' ? 'Got it!' : 'Pass'}</div>
      )}

      {/* Tap fallbacks — full-height zones behind the card. */}
      <button
        className="headsup-zone headsup-zone--pass"
        aria-label="Pass"
        onClick={() => advance(false)}
      >
        <span>▲ Pass</span>
      </button>
      <button
        className="headsup-zone headsup-zone--hit"
        aria-label="Got it"
        onClick={() => advance(true)}
      >
        <span>▼ Got it</span>
      </button>
    </div>
  );
}

function Card({ deckId, country }) {
  if (deckId === 'flags') {
    return (
      <>
        <Flag code={country.cca2} size="w640" className="headsup-flag" />
        <div className="headsup-name">{country.name}</div>
      </>
    );
  }
  if (deckId === 'shapes') {
    // Location deck: show *where* it is, no name — the room clues the region.
    return <LocatorMap cca3={country.cca3} className="headsup-locator" />;
  }
  if (deckId === 'capitals') {
    return (
      <>
        <div className="headsup-big">{country.capital}</div>
        <div className="headsup-sub">capital of {country.name}</div>
      </>
    );
  }
  return (
    <>
      <div className="headsup-big">{country.name}</div>
      <div className="headsup-sub">{country.region}</div>
    </>
  );
}
