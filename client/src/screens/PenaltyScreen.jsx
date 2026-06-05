import React, { useState, useEffect } from 'react';

const DIRS = [
  { label: '◀ Left', dir: 0, emoji: '⬅️' },
  { label: '▲ Centre', dir: 1, emoji: '⬆️' },
  { label: 'Right ▶', dir: 2, emoji: '➡️' },
];

const GK_POSITIONS = ['left', 'center', 'right'];

export default function PenaltyScreen({ socket, penaltyData, penaltyResult, player }) {
  const [selected, setSelected] = useState(null);
  const [timeLeft, setTimeLeft] = useState(8);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    setSelected(null);
    setTimeLeft(penaltyData?.timeLimit || 8);
  }, [penaltyData?.round]);

  useEffect(() => {
    if (!penaltyData) return;
    const t = setInterval(() => setTimeLeft(x => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [penaltyData?.round]);

  const shoot = (dir) => {
    if (selected !== null || penaltyResult) return;
    setSelected(dir);
    socket.emit('penalty:shoot', { direction: dir });
  };

  if (!penaltyData) return null;

  const myResult = penaltyResult?.results?.[player?.id];
  const isGoal = myResult?.goal;

  return (
    <div className="game-bg min-h-screen flex flex-col items-center px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between w-full mb-4">
        <div className="bg-white/10 px-3 py-1.5 rounded-full">
          <span className="text-white/70 text-sm font-semibold">Kick {penaltyData.round}/{penaltyData.total}</span>
        </div>
        <div className="text-3xl">🥅</div>
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3"/>
            <circle cx="24" cy="24" r="20" fill="none"
              stroke={timeLeft > 4 ? '#22c55e' : '#ef4444'}
              strokeWidth="3"
              strokeDasharray={`${2 * Math.PI * 20}`}
              strokeDashoffset={`${2 * Math.PI * 20 * (1 - timeLeft / (penaltyData.timeLimit || 8))}`}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-white font-black text-base">{timeLeft}</span>
        </div>
      </div>

      <p className="text-white font-black text-2xl mb-2 text-shadow">PENALTY SHOOTOUT</p>
      <p className="text-white/50 text-sm mb-6">Choose your direction!</p>

      {/* Goal Visualiser */}
      <div className="w-full max-w-xs mb-6">
        <div className="relative bg-white/5 border-2 border-white/20 rounded-xl overflow-hidden" style={{ paddingTop: '45%' }}>
          {/* Goal posts */}
          <div className="absolute inset-0 flex">
            <div className="w-2 bg-white/40" />
            <div className="flex-1 relative">
              <div className="absolute top-0 left-0 right-0 h-2 bg-white/40" />
              {/* Net pattern */}
              <div className="absolute inset-2 opacity-20"
                style={{
                  backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
                  backgroundSize: '20px 15px'
                }}
              />
              {/* Goalkeeper */}
              {myResult && (
                <div className={`absolute bottom-1 text-2xl transition-all duration-500 ${
                  myResult.goalkeeperDir === 0 ? 'left-1' : myResult.goalkeeperDir === 1 ? 'left-1/2 -translate-x-1/2' : 'right-1'
                }`}>
                  🧤
                </div>
              )}
              {/* Ball */}
              {myResult && (
                <div className={`absolute top-1/3 text-xl transition-all duration-700 ${
                  myResult.dir === 0 ? 'left-2' : myResult.dir === 1 ? 'left-1/2 -translate-x-1/2' : 'right-2'
                } ${isGoal ? 'opacity-100' : 'opacity-40'}`}>
                  ⚽
                </div>
              )}
            </div>
            <div className="w-2 bg-white/40" />
          </div>
        </div>
        <div className="text-center text-white/40 text-xs mt-1">Goal · · · · · · · · · · · · · ·</div>
      </div>

      {/* Result Banner */}
      {myResult && (
        <div className={`w-full max-w-xs mb-5 py-4 rounded-2xl text-center font-black text-2xl animate-bounce-in ${
          isGoal ? 'bg-green-500/40 text-green-300 border border-green-400/40' : 'bg-red-500/30 text-red-300 border border-red-400/40'
        }`}>
          {isGoal ? '⚽ GOAL!!!' : '🧤 Saved!'}
        </div>
      )}

      {/* Direction Buttons */}
      {!penaltyResult && (
        <div className="w-full max-w-xs grid grid-cols-3 gap-3">
          {DIRS.map(({ label, dir, emoji }) => (
            <button
              key={dir}
              onClick={() => shoot(dir)}
              disabled={selected !== null}
              className={`flex flex-col items-center justify-center gap-2 py-5 rounded-2xl font-bold text-sm transition-all btn-press ${
                selected === dir
                  ? 'bg-brand-blue border-2 border-brand-blue-light scale-95 shadow-lg shadow-blue-700/50'
                  : selected !== null
                  ? 'bg-white/5 text-white/30'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40'
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs">{label.split(' ')[1] || label}</span>
            </button>
          ))}
        </div>
      )}

      {selected !== null && !penaltyResult && (
        <div className="mt-4 text-white/50 text-sm animate-fade-in text-center">
          🔒 Shot selected! Waiting for result...
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
