import React, { useState, useEffect } from 'react';

export default function PredictScreen({ socket, predictData }) {
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    setHome(0);
    setAway(0);
    setSubmitted(false);
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
  const pct = (timeLeft / (predictData.timeLimit || 30)) * 100;

  return (
    <div className="game-bg min-h-screen flex flex-col px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="bg-white/10 px-3 py-1.5 rounded-full">
          <span className="text-white/70 text-sm font-semibold">Match {predictData.index + 1}/{predictData.total}</span>
        </div>
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
            <circle cx="24" cy="24" r="20" fill="none"
              stroke={timeLeft > 15 ? '#22c55e' : timeLeft > 7 ? '#f59e0b' : '#ef4444'}
              strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={`${2 * Math.PI * 20 * (1 - pct / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-white font-black text-base">{timeLeft}</span>
        </div>
        <div className="bg-white/10 px-3 py-1.5 rounded-full">
          <span className="text-white/70 text-sm font-semibold">🎯 Predict</span>
        </div>
      </div>

      <p className="text-white/50 text-center text-sm font-semibold mb-5 uppercase tracking-wider">Predict the Final Score</p>

      {/* Match Display */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-6 mb-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-3xl mb-1">{match.homeFlag}</div>
            <p className="text-white font-black text-lg leading-tight">{match.home}</p>
          </div>
          <div className="px-4 text-center">
            <div className="text-white/30 text-3xl font-black">VS</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-3xl mb-1">{match.awayFlag}</div>
            <p className="text-white font-black text-lg leading-tight">{match.away}</p>
          </div>
        </div>
      </div>

      {/* Score Pickers */}
      {!reveal && !submitted && (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 mb-5 animate-slide-up">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider text-center mb-4">Your Prediction</p>
          <div className="flex items-center justify-center gap-6">
            {/* Home score */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-white/50 text-xs font-medium">{match.home}</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setHome(h => Math.max(0, h - 1))} className="bg-white/10 text-white w-10 h-10 rounded-xl text-xl font-black btn-press hover:bg-white/20 transition-all">−</button>
                <span className="text-white font-black text-4xl w-10 text-center">{home}</span>
                <button onClick={() => setHome(h => Math.min(9, h + 1))} className="bg-brand-blue text-white w-10 h-10 rounded-xl text-xl font-black btn-press hover:bg-brand-blue-light transition-all">+</button>
              </div>
            </div>
            <div className="text-white/30 text-2xl font-black">:</div>
            {/* Away score */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-white/50 text-xs font-medium">{match.away}</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setAway(a => Math.max(0, a - 1))} className="bg-white/10 text-white w-10 h-10 rounded-xl text-xl font-black btn-press hover:bg-white/20 transition-all">−</button>
                <span className="text-white font-black text-4xl w-10 text-center">{away}</span>
                <button onClick={() => setAway(a => Math.min(9, a + 1))} className="bg-brand-blue text-white w-10 h-10 rounded-xl text-xl font-black btn-press hover:bg-brand-blue-light transition-all">+</button>
              </div>
            </div>
          </div>

          <button
            onClick={submit}
            className="w-full mt-5 bg-gradient-to-r from-brand-blue to-brand-blue-light text-white font-black text-lg py-4 rounded-2xl shadow-lg btn-press"
          >
            🎯 Lock In Prediction
          </button>
        </div>
      )}

      {submitted && !reveal && (
        <div className="bg-white/10 border border-white/20 rounded-2xl p-5 text-center animate-bounce-in">
          <p className="text-white font-black text-xl">✅ Prediction Locked!</p>
          <p className="text-white/60 mt-1 text-2xl font-black">{match.home} {home} – {away} {match.away}</p>
          <p className="text-white/40 text-sm mt-2">Waiting for result...</p>
        </div>
      )}

      {reveal && (
        <div className="bg-gradient-to-br from-yellow-500/30 to-orange-500/30 border border-yellow-400/40 rounded-2xl p-5 text-center animate-bounce-in">
          <p className="text-white/60 text-sm mb-1">Final Score</p>
          <p className="text-white font-black text-4xl">{reveal.actualHome} – {reveal.actualAway}</p>
          <p className="text-white/60 text-sm mt-1">{match.home} vs {match.away}</p>
          {submitted && (
            <p className="text-yellow-300 font-bold mt-2">Your guess: {home} – {away}</p>
          )}
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}
