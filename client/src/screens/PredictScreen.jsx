import React, { useState, useEffect } from 'react';

export default function PredictScreen({ socket, predictData }) {
  const [home, setHome]         = useState(0);
  const [away, setAway]         = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    setHome(0); setAway(0); setSubmitted(false);
    setTimeLeft(predictData?.timeLimit || 30);
  }, [predictData?.index]);

  useEffect(() => {
    if (!predictData) return;
    const t = setInterval(() => setTimeLeft(x => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [predictData?.index]);

  const submit = () => {
    if (submitted) return;
    socket.emit('predict:submit', { home, away });
    setSubmitted(true);
  };

  if (!predictData) return null;
  const { match, reveal } = predictData;
  const total = predictData.timeLimit || 30;
  const pct   = (timeLeft / total) * 100;
  const timerColor = timeLeft > 15 ? '#22c55e' : timeLeft > 7 ? '#f59e0b' : '#ef4444';

  const ScoreStepper = ({ label, value, onChange }) => (
    <div className="flex flex-col items-center gap-2">
      <p className="text-white/50 text-xs font-bold uppercase tracking-wide">{label}</p>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(v => Math.max(0, v - 1))}
          className="bg-white/10 border border-white/20 text-white w-12 h-12 rounded-2xl text-2xl font-black btn-press hover:bg-white/20"
        >−</button>
        <span className="text-white font-black text-5xl w-12 text-center tabular-nums">{value}</span>
        <button
          onClick={() => onChange(v => Math.min(9, v + 1))}
          className="bg-blue-600 text-white w-12 h-12 rounded-2xl text-2xl font-black btn-press hover:bg-blue-500"
        >+</button>
      </div>
    </div>
  );

  return (
    <div className="screen game-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
        <div className="bg-white/10 px-3 py-2 rounded-xl">
          <span className="text-white/70 text-sm font-bold">Match {predictData.index + 1}/{predictData.total}</span>
        </div>
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4"/>
            <circle cx="28" cy="28" r="23" fill="none" stroke={timerColor} strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 23}`}
              strokeDashoffset={`${2 * Math.PI * 23 * (1 - pct / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
              strokeLinecap="round"/>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-white font-black text-lg">{timeLeft}</span>
        </div>
        <div className="bg-white/10 px-3 py-2 rounded-xl">
          <span className="text-white/70 text-sm font-bold">🎯 Predict</span>
        </div>
      </div>

      <p className="text-white/40 text-center text-xs font-bold uppercase tracking-widest mb-4 flex-shrink-0">
        Predict the Final Score
      </p>

      {/* Match card */}
      <div className="mx-4 mb-5 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 flex-shrink-0 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-4xl mb-1">{match.homeFlag}</div>
            <p className="text-white font-black text-base leading-tight">{match.home}</p>
          </div>
          <div className="px-3 text-center">
            <span className="text-white/30 font-black text-xl">VS</span>
          </div>
          <div className="text-center flex-1">
            <div className="text-4xl mb-1">{match.awayFlag}</div>
            <p className="text-white font-black text-base leading-tight">{match.away}</p>
          </div>
        </div>
      </div>

      {/* Score picker */}
      {!reveal && !submitted && (
        <div className="mx-4 bg-white/5 border border-white/10 rounded-3xl p-5 mb-4 animate-slide-up flex-shrink-0">
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest text-center mb-5">Your Prediction</p>
          <div className="flex items-center justify-center gap-4">
            <ScoreStepper label={match.home} value={home} onChange={setHome} />
            <span className="text-white/20 font-black text-3xl mt-5">:</span>
            <ScoreStepper label={match.away} value={away} onChange={setAway} />
          </div>
          <button
            onClick={submit}
            className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-black text-xl py-4 rounded-2xl shadow-xl shadow-blue-900/50 btn-press"
          >
            🎯 Lock In Prediction
          </button>
        </div>
      )}

      {submitted && !reveal && (
        <div className="mx-4 bg-white/10 border border-white/20 rounded-2xl p-5 text-center animate-bounce-in flex-shrink-0">
          <p className="text-white font-black text-xl mb-1">✅ Prediction Locked!</p>
          <p className="text-white/60 text-3xl font-black mt-1">{home} – {away}</p>
          <p className="text-white/30 text-sm mt-2">Waiting for result…</p>
        </div>
      )}

      {reveal && (
        <div className="mx-4 bg-gradient-to-br from-yellow-500/25 to-orange-500/25 border border-yellow-400/40 rounded-2xl p-5 text-center animate-bounce-in flex-shrink-0">
          <p className="text-white/50 text-sm mb-1">Final Score</p>
          <p className="text-white font-black text-5xl mb-1">{reveal.actualHome} – {reveal.actualAway}</p>
          <p className="text-white/40 text-sm">{match.home} vs {match.away}</p>
          {submitted && (
            <p className="text-yellow-300 font-bold text-sm mt-2">
              Your guess: {home} – {away}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
