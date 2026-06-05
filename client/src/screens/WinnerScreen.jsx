import React, { useEffect, useState } from 'react';

const CONFETTI_COLORS = ['#1565C0', '#C62828', '#FFD700', '#22c55e', '#fff'];

function Particle({ color }) {
  const style = {
    position: 'fixed',
    left: `${Math.random() * 100}%`,
    top: `-10px`,
    width: `${Math.random() * 8 + 4}px`,
    height: `${Math.random() * 12 + 6}px`,
    backgroundColor: color,
    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
    animation: `fall ${Math.random() * 3 + 2}s linear ${Math.random() * 2}s forwards`,
    opacity: 0,
    transform: `rotate(${Math.random() * 360}deg)`,
  };
  return <div style={style} />;
}

export default function WinnerScreen({ winner, leaderboard, player }) {
  const [particles] = useState(() => Array.from({ length: 60 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  })));

  const w = winner?.winner;
  const lb = winner?.leaderboard || leaderboard;
  const isWinner = w?.id === player?.id;

  return (
    <div className="game-bg min-h-screen flex flex-col items-center px-4 pt-8 overflow-hidden relative">
      {/* Confetti */}
      <style>{`
        @keyframes fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {particles.map(p => <Particle key={p.id} color={p.color} />)}

      {/* Trophy */}
      <div className="text-8xl mb-4 animate-bounce-in">🏆</div>

      {/* Winner Announce */}
      <div className="text-center mb-6 animate-fade-in">
        <p className="text-white/60 font-semibold text-sm uppercase tracking-widest mb-1">Champion</p>
        <h1 className="text-4xl font-black text-white text-shadow-lg">
          {w?.name || 'Player'}
        </h1>
        <div className="flex items-center justify-center gap-2 mt-2">
          <span className="text-yellow-300 font-black text-2xl">{w?.score?.toLocaleString()}</span>
          <span className="text-yellow-400/60 text-sm">total points</span>
        </div>
      </div>

      {isWinner && (
        <div className="bg-yellow-500/20 border border-yellow-400/40 rounded-2xl px-6 py-3 mb-6 animate-bounce-in">
          <p className="text-yellow-300 font-black text-xl text-center">🎉 YOU WON! 🎉</p>
        </div>
      )}

      {/* Top 3 Podium */}
      <div className="flex items-end gap-3 mb-6 w-full max-w-sm justify-center">
        {lb?.slice(0, 3).map((p, i) => {
          const heights = ['h-24', 'h-32', 'h-20'];
          const reorder = [lb[1], lb[0], lb[2]].filter(Boolean);
          const podiumOrder = [1, 0, 2];
          const entry = lb[podiumOrder[i]];
          if (!entry) return null;
          return (
            <div key={entry.id} className="flex flex-col items-center flex-1">
              <div className="text-2xl mb-1">{entry.name.split(' ')[0]}</div>
              <div className="text-white/80 text-xs font-bold text-center leading-tight mb-1">
                {entry.name.split(' ').slice(1).join(' ')}
              </div>
              <div className={`w-full ${heights[i]} rounded-t-xl flex flex-col items-center justify-center ${
                i === 1 ? 'bg-yellow-500/30 border border-yellow-400/40' :
                i === 0 ? 'bg-gray-400/20 border border-gray-400/30' :
                'bg-orange-700/20 border border-orange-600/30'
              }`}>
                <div className="text-2xl">{['🥈', '🥇', '🥉'][i]}</div>
                <div className="text-white font-black text-sm">{entry.score.toLocaleString()}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Leaderboard */}
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-slide-up">
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Final Standings</p>
        </div>
        {lb?.slice(0, 8).map((p, i) => (
          <div key={p.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0 ${p.id === player?.id ? 'bg-brand-blue/20' : ''}`}>
            <span className="text-white/40 text-sm w-6">#{i + 1}</span>
            <span className="text-lg">{p.name.split(' ')[0]}</span>
            <span className="text-white/80 text-sm flex-1">{p.name.split(' ').slice(1).join(' ')}</span>
            <span className="text-white font-bold text-sm">{p.score.toLocaleString()}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 text-center animate-fade-in">
        <p className="text-white/30 text-sm">Deep Seafood Football Championship 2024</p>
        <p className="text-3xl mt-2">⚽ 🏆 ⚽</p>
      </div>

      <div className="h-8" />
    </div>
  );
}
