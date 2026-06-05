import React, { useEffect, useState } from 'react';

const COLORS = [
  'from-red-500 to-red-700',
  'from-blue-500 to-blue-700',
  'from-yellow-500 to-yellow-700',
  'from-green-500 to-green-700',
];
const LABELS = ['A', 'B', 'C', 'D'];

export default function QuizScreen({ socket, quizData, quizReveal }) {
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState(20);
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong'

  useEffect(() => {
    setSelected(null);
    setFeedback(null);
    setTimeLeft(quizData?.timeLimit || 20);
  }, [quizData?.index]);

  useEffect(() => {
    if (!quizData) return;
    const interval = setInterval(() => {
      setTimeLeft(t => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [quizData?.index]);

  useEffect(() => {
    if (!quizReveal || selected === null) return;
    setFeedback(selected === quizReveal.correctIndex ? 'correct' : 'wrong');
  }, [quizReveal]);

  socket.once('quiz:answered', () => {});
  socket.once('quiz:correct', () => setFeedback('correct'));

  const answer = (idx) => {
    if (selected !== null || quizReveal) return;
    setSelected(idx);
    socket.emit('quiz:answer', { optionIndex: idx });
  };

  if (!quizData) return null;

  const pct = (timeLeft / (quizData.timeLimit || 20)) * 100;
  const timerColor = timeLeft > 10 ? '#22c55e' : timeLeft > 5 ? '#f59e0b' : '#ef4444';

  return (
    <div className="game-bg min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="bg-white/10 px-3 py-1.5 rounded-full">
          <span className="text-white/70 text-sm font-semibold">Q{quizData.index + 1}/{quizData.total}</span>
        </div>
        {/* Timer */}
        <div className="relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
            <circle cx="28" cy="28" r="24" fill="none" stroke={timerColor} strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 24}`}
              strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-white font-black text-lg">{timeLeft}</span>
        </div>
        <div className="bg-white/10 px-3 py-1.5 rounded-full">
          <span className="text-white/70 text-sm font-semibold">⚽ Quiz</span>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 flex flex-col px-4 pt-4">
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 mb-6 animate-fade-in">
          <p className="text-white font-bold text-xl leading-snug text-center text-shadow">{quizData.question}</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 flex-1">
          {quizData.options.map((opt, i) => {
            let extra = '';
            if (quizReveal) {
              if (i === quizReveal.correctIndex) extra = 'ring-4 ring-green-400 bg-green-600/60';
              else if (i === selected) extra = 'ring-4 ring-red-400 bg-red-600/40 opacity-70';
              else extra = 'opacity-40';
            } else if (selected === i) {
              extra = 'ring-4 ring-white/60 scale-95';
            }

            return (
              <button
                key={i}
                onClick={() => answer(i)}
                disabled={selected !== null || !!quizReveal}
                className={`option-btn bg-gradient-to-br ${COLORS[i]} text-white font-bold rounded-2xl p-4 flex items-start gap-3 shadow-lg transition-all btn-press ${extra}`}
              >
                <span className="bg-white/20 rounded-lg w-7 h-7 flex items-center justify-center text-sm font-black flex-shrink-0">
                  {LABELS[i]}
                </span>
                <span className="text-left text-sm leading-tight">{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`mt-4 text-center py-4 rounded-2xl font-black text-2xl animate-bounce-in ${
            feedback === 'correct' ? 'bg-green-500/30 text-green-300' : 'bg-red-500/30 text-red-300'
          }`}>
            {feedback === 'correct' ? '🎉 Correct! +Points' : '❌ Wrong!'}
          </div>
        )}

        {selected !== null && !feedback && !quizReveal && (
          <div className="mt-4 text-center py-3 rounded-2xl bg-white/10 text-white/70 font-semibold animate-fade-in">
            ✅ Answer locked in!
          </div>
        )}
      </div>

      <div className="h-6" />
    </div>
  );
}
