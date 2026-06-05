import React, { useState, useEffect } from 'react';

export default function GuessPlayerScreen({ socket, guessData }) {
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState(null); // null | {type:'correct',pts} | {type:'wrong'} | {type:'waiting'}

  useEffect(() => {
    setAnswer('');
    setStatus(null);
  }, [guessData?.index]);

  useEffect(() => {
    const onCorrect = ({ pts }) => setStatus({ type: 'correct', pts });
    const onWrong   = ()         => setStatus({ type: 'wrong' });
    socket.on('guess:correct', onCorrect);
    socket.on('guess:wrong',   onWrong);
    return () => { socket.off('guess:correct', onCorrect); socket.off('guess:wrong', onWrong); };
  }, [socket]);

  const submit = () => {
    if (!answer.trim() || status?.type === 'correct' || status?.type === 'waiting') return;
    socket.emit('guess:answer', { answer });
    setStatus({ type: 'waiting' });
  };

  if (!guessData) return null;

  const { revealed, clues, index, total, maxPoints, clueNum } = guessData;
  const locked = status?.type === 'correct' || !!revealed;

  return (
    <div className="screen game-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
        <div className="bg-white/10 px-3 py-2 rounded-xl">
          <span className="text-white/70 text-sm font-bold">Player {index + 1} / {total}</span>
        </div>
        <span className="text-3xl">🕵️</span>
        <div className="bg-yellow-500/20 border border-yellow-400/30 px-3 py-2 rounded-xl">
          <span className="text-yellow-300 text-sm font-black">+{maxPoints} pts</span>
        </div>
      </div>

      {/* Mystery silhouette */}
      <div className="mx-4 mb-4 bg-gradient-to-br from-white/10 to-white/5 border border-white/15 rounded-3xl py-5 flex flex-col items-center flex-shrink-0 animate-fade-in">
        <div className="text-7xl mb-1 grayscale opacity-80">❓</div>
        <p className="text-white/40 font-bold text-sm uppercase tracking-widest">Who Am I?</p>
        <p className="text-white/25 text-xs mt-1">Clue {clueNum} of {clues?.length}</p>
      </div>

      {/* Clues */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-2">
        {clues?.map((clue, i) => (
          <div
            key={i}
            className="flex items-start gap-3 bg-white/10 border border-white/20 rounded-2xl px-4 py-3.5 animate-slide-up"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            <span className="bg-blue-600 text-white text-xs font-black w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-white font-medium text-sm leading-snug">{clue}</span>
          </div>
        ))}
      </div>

      {/* Answer / Reveal */}
      <div className="px-4 pb-6 pt-3 flex-shrink-0">
        {revealed && (
          <div className="bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border border-yellow-400/40 rounded-2xl p-4 text-center animate-bounce-in mb-3">
            <p className="text-white/50 text-xs mb-1">The answer was…</p>
            <p className="text-white font-black text-3xl">{revealed}</p>
          </div>
        )}

        {status?.type === 'correct' && (
          <div className="bg-green-500/30 border border-green-400/40 rounded-2xl py-4 text-center animate-bounce-in">
            <p className="text-green-300 font-black text-2xl">🎉 Correct!</p>
            <p className="text-green-400/70 text-sm mt-1">+{status.pts} points</p>
          </div>
        )}

        {!revealed && status?.type !== 'correct' && (
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="text"
              placeholder="Type player name…"
              value={answer}
              onChange={e => { setAnswer(e.target.value); if (status?.type === 'wrong') setStatus(null); }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              disabled={locked}
              className="flex-1 bg-white/10 border-2 border-white/20 text-white placeholder-white/35 rounded-2xl px-4 py-3.5 font-semibold text-base focus:outline-none focus:border-blue-400 transition-all disabled:opacity-40"
            />
            <button
              onClick={submit}
              disabled={!answer.trim() || locked}
              className="bg-blue-600 text-white font-black px-5 rounded-2xl btn-press disabled:opacity-40 text-lg min-w-[56px]"
            >
              ✓
            </button>
          </div>
        )}

        {status?.type === 'wrong' && !revealed && (
          <p className="text-red-400 text-center text-sm mt-2 font-semibold animate-fade-in">❌ Wrong — try again!</p>
        )}
        {status?.type === 'waiting' && (
          <p className="text-white/40 text-center text-sm mt-2 animate-fade-in">Checking…</p>
        )}
      </div>
    </div>
  );
}
