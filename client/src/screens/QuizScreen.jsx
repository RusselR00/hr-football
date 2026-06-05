import React, { useEffect, useState } from 'react';

const OPTION_STYLES = [
  { bg: 'from-red-500 to-red-700',    active: 'ring-red-300' },
  { bg: 'from-blue-500 to-blue-700',  active: 'ring-blue-300' },
  { bg: 'from-amber-500 to-amber-700',active: 'ring-amber-300' },
  { bg: 'from-green-500 to-green-700',active: 'ring-green-300' },
];
const LABELS = ['A','B','C','D'];

export default function QuizScreen({ socket, quizData, quizReveal }) {
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setSelected(null);
    setFeedback(null);
    setTimeLeft(quizData?.timeLimit || 20);
  }, [quizData?.index]);

  useEffect(() => {
    if (!quizData) return;
    const iv = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(iv);
  }, [quizData?.index]);

  useEffect(() => {
    if (!quizReveal || selected === null) return;
    setFeedback(selected === quizReveal.correctIndex ? 'correct' : 'wrong');
  }, [quizReveal]);

  const answer = (idx) => {
    if (selected !== null || quizReveal) return;
    setSelected(idx);
    socket.emit('quiz:answer', { optionIndex: idx });
  };

  if (!quizData) return null;

  const total = quizData.timeLimit || 20;
  const pct   = (timeLeft / total) * 100;
  const timerColor = timeLeft > 10 ? '#22c55e' : timeLeft > 5 ? '#f59e0b' : '#ef4444';

  return (
    <div className="screen game-bg flex flex-col">
      {/* ── TOP BAR ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 flex-shrink-0">
        <div className="bg-white/10 px-3 py-2 rounded-xl">
          <span className="text-white/70 text-sm font-bold">
            Q{quizData.index + 1} / {quizData.total}
          </span>
        </div>

        {/* Timer ring */}
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="23" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4"/>
            <circle cx="28" cy="28" r="23" fill="none" stroke={timerColor} strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 23}`}
              strokeDashoffset={`${2 * Math.PI * 23 * (1 - pct / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              strokeLinecap="round"/>
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-white font-black text-lg">
            {timeLeft}
          </span>
        </div>

        <div className="bg-white/10 px-3 py-2 rounded-xl">
          <span className="text-white/70 text-sm font-bold">⚽ Quiz</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 mx-4 bg-white/10 rounded-full overflow-hidden flex-shrink-0 mb-4">
        <div
          className="h-full bg-blue-400 rounded-full transition-all duration-1000"
          style={{ width: `${((quizData.index + 1) / quizData.total) * 100}%` }}
        />
      </div>

      {/* ── QUESTION ── */}
      <div className="mx-4 mb-5 bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl p-5 flex-shrink-0 animate-fade-in">
        <p className="text-white font-bold text-lg leading-snug text-center text-shadow">
          {quizData.question}
        </p>
      </div>

      {/* ── OPTIONS ── */}
      <div className="flex-1 grid grid-cols-2 gap-3 px-4 content-start">
        {quizData.options.map((opt, i) => {
          const style = OPTION_STYLES[i];
          let extra = '';
          if (quizReveal) {
            if (i === quizReveal.correctIndex)
              extra = 'ring-4 ring-green-400 brightness-110';
            else if (i === selected)
              extra = 'ring-4 ring-red-400 opacity-60';
            else
              extra = 'opacity-35';
          } else if (selected === i) {
            extra = 'ring-4 ring-white/60 scale-95';
          }

          return (
            <button
              key={i}
              onClick={() => answer(i)}
              disabled={selected !== null || !!quizReveal}
              className={`option-btn bg-gradient-to-br ${style.bg} text-white font-bold rounded-2xl p-4 flex items-start gap-3 shadow-lg active:scale-95 transition-all min-h-[80px] ${extra}`}
            >
              <span className="bg-black/20 rounded-xl w-8 h-8 flex items-center justify-center text-sm font-black flex-shrink-0 mt-0.5">
                {LABELS[i]}
              </span>
              <span className="text-left text-sm leading-snug">{opt}</span>
            </button>
          );
        })}
      </div>

      {/* ── FEEDBACK ── */}
      <div className="px-4 pb-6 pt-3 flex-shrink-0">
        {feedback && (
          <div className={`text-center py-4 rounded-2xl font-black text-2xl animate-bounce-in ${
            feedback === 'correct'
              ? 'bg-green-500/30 border border-green-400/40 text-green-300'
              : 'bg-red-500/30 border border-red-400/40 text-red-300'
          }`}>
            {feedback === 'correct' ? '🎉 Correct! Points earned!' : '❌ Incorrect!'}
          </div>
        )}
        {selected !== null && !feedback && !quizReveal && (
          <div className="text-center py-4 rounded-2xl bg-white/10 border border-white/20 text-white/60 font-semibold animate-fade-in">
            ✅ Locked in — waiting for reveal…
          </div>
        )}
      </div>
    </div>
  );
}
