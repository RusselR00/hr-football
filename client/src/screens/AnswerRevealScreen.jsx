import React, { useEffect, useState, useRef } from 'react';

const LABELS  = ['A','B','C','D'];
const COLORS  = ['bg-red-500','bg-blue-500','bg-amber-500','bg-green-500'];

export default function AnswerRevealScreen({ revealData }) {
  const [explTimer, setExplTimer] = useState(0);
  const ivRef = useRef(null);

  useEffect(() => {
    if (!revealData?.explanation) return;
    setExplTimer(10);
    clearInterval(ivRef.current);
    ivRef.current = setInterval(() => {
      setExplTimer(t => { if (t <= 1) { clearInterval(ivRef.current); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(ivRef.current);
  }, [revealData?.question]);

  if (!revealData) return null;

  const { question, options, correctIndex, explanation, correctCount, totalAnswered, feedback } = revealData;

  return (
    <div className="screen game-bg flex flex-col px-4 pt-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className={`px-3 py-1.5 rounded-full text-sm font-black ${
          feedback === 'correct' ? 'bg-green-500/30 text-green-300 border border-green-400/40' : 'bg-red-500/30 text-red-300 border border-red-400/40'
        }`}>
          {feedback === 'correct' ? '🎉 Correct!' : '❌ Incorrect!'}
        </div>
        <div className="text-2xl">⚽</div>
        {totalAnswered > 0 && (
          <div className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-full text-center">
            <span className="text-green-400 font-black text-sm">{correctCount}</span>
            <span className="text-white/40 text-xs">/{totalAnswered} right</span>
          </div>
        )}
      </div>

      {/* Question */}
      <div className="bg-white/10 border border-white/20 rounded-2xl p-4 mb-4 flex-shrink-0 animate-fade-in">
        <p className="text-white font-bold text-base leading-snug text-center">{question}</p>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-2.5 mb-4 flex-shrink-0">
        {options.map((opt, i) => {
          const isCorrect = i === correctIndex;
          return (
            <div key={i}
              className={`rounded-2xl p-3 flex items-start gap-2 border-2 transition-all animate-fade-in ${
                isCorrect
                  ? 'bg-green-500/30 border-green-400 shadow-lg shadow-green-900/50'
                  : 'bg-white/5 border-white/10 opacity-50'
              }`}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <span className={`rounded-xl w-7 h-7 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5 ${
                isCorrect ? 'bg-green-400 text-white' : 'bg-white/10 text-white/40'
              }`}>
                {isCorrect ? '✓' : LABELS[i]}
              </span>
              <span className={`text-sm font-semibold leading-snug ${isCorrect ? 'text-white' : 'text-white/40'}`}>
                {opt}
              </span>
            </div>
          );
        })}
      </div>

      {/* Explanation */}
      {explanation && (
        <div className="bg-blue-900/40 border border-blue-400/30 rounded-2xl px-4 py-3 animate-slide-up flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-blue-300 text-xs font-black uppercase tracking-wider">💡 Did you know?</p>
            {explTimer > 0 && <span className="text-blue-400/60 text-xs font-bold tabular-nums">{explTimer}s</span>}
          </div>
          <p className="text-white/80 text-sm leading-relaxed">{explanation}</p>
        </div>
      )}

      <div className="flex-1" />
      <p className="text-white/20 text-xs text-center pb-4 flex-shrink-0">Waiting for host to continue…</p>
    </div>
  );
}
