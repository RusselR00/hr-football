import React, { useState, useEffect } from 'react';

export default function GuessPlayerScreen({ socket, guessData }) {
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState(null); // 'correct' | 'wrong' | 'answered'

  useEffect(() => {
    setAnswer('');
    setStatus(null);
  }, [guessData?.index]);

  useEffect(() => {
    socket.on('guess:correct', ({ pts }) => setStatus({ type: 'correct', pts }));
    socket.on('guess:wrong', () => setStatus({ type: 'wrong' }));
    return () => {
      socket.off('guess:correct');
      socket.off('guess:wrong');
    };
  }, []);

  const submit = () => {
    if (!answer.trim() || status) return;
    socket.emit('guess:answer', { answer });
    setStatus({ type: 'waiting' });
  };

  if (!guessData) return null;

  const revealed = guessData.revealed;

  return (
    <div className="game-bg min-h-screen flex flex-col px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="bg-white/10 px-3 py-1.5 rounded-full">
          <span className="text-white/70 text-sm font-semibold">Player {guessData.index + 1}/{guessData.total}</span>
        </div>
        <div className="text-2xl">🕵️</div>
        <div className="bg-yellow-500/20 border border-yellow-500/40 px-3 py-1.5 rounded-full">
          <span className="text-yellow-300 text-sm font-bold">+{guessData.maxPoints} pts</span>
        </div>
      </div>

      {/* Silhouette / Mystery player */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-5 text-center animate-fade-in">
        <div className="text-8xl mb-2 filter grayscale">❓</div>
        <p className="text-white/40 text-sm font-medium">WHO AM I?</p>
      </div>

      {/* Clues */}
      <div className="space-y-3 mb-6">
        {guessData.clues.map((clue, i) => (
          <div key={i} className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 flex items-start gap-3 animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
            <span className="bg-brand-blue text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-white font-medium text-sm leading-snug">{clue}</span>
          </div>
        ))}
      </div>

      {/* Reveal */}
      {revealed && (
        <div className="bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border border-yellow-400/40 rounded-2xl p-5 text-center animate-bounce-in mb-4">
          <p className="text-white/60 text-sm mb-1">The answer was...</p>
          <p className="text-white font-black text-3xl">{revealed}</p>
        </div>
      )}

      {/* Answer Input */}
      {!revealed && !status?.type?.includes('correct') && (
        <div className="mt-auto">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Type player name..."
              value={answer}
              onChange={e => { setAnswer(e.target.value); if (status?.type === 'wrong') setStatus(null); }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              disabled={status?.type === 'correct' || status?.type === 'waiting'}
              className="flex-1 bg-white/10 border border-white/30 text-white placeholder-white/40 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-brand-blue-light transition-all"
            />
            <button
              onClick={submit}
              disabled={!answer.trim() || status?.type === 'correct' || status?.type === 'waiting'}
              className="bg-brand-blue text-white font-black px-5 py-3 rounded-xl btn-press disabled:opacity-40 transition-all"
            >
              ✓
            </button>
          </div>

          {status?.type === 'wrong' && (
            <p className="text-red-400 text-center text-sm mt-2 font-semibold animate-fade-in">❌ Wrong, try again!</p>
          )}
          {status?.type === 'waiting' && (
            <p className="text-white/50 text-center text-sm mt-2 animate-fade-in">Checking...</p>
          )}
        </div>
      )}

      {status?.type === 'correct' && (
        <div className="mt-4 bg-green-500/30 border border-green-400/40 rounded-2xl py-4 text-center animate-bounce-in">
          <p className="text-green-300 font-black text-2xl">🎉 You got it!</p>
          <p className="text-green-400/80 text-sm mt-1">+{status.pts} points</p>
        </div>
      )}

      <div className="h-6" />
    </div>
  );
}
