import React from 'react';

export default function LobbyScreen({ player, leaderboard }) {
  return (
    <div className="game-bg min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center animate-bounce-in">
        <div className="text-7xl mb-4">✅</div>
        <h1 className="text-3xl font-black text-white">You're In!</h1>
        <p className="text-white/60 mt-2 text-lg">{player?.name}</p>
      </div>

      <div className="mt-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 w-full max-w-sm text-center animate-fade-in">
        <p className="text-white/60 text-sm font-medium mb-1">WAITING FOR HOST TO START</p>
        <div className="flex gap-1 justify-center mt-3">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 bg-brand-blue-light rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>

      <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-4 w-full max-w-sm animate-fade-in">
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Players Joined ({leaderboard.length})</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {leaderboard.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <span className="text-xl">{p.name.split(' ')[0]}</span>
              <span className="text-white/80 text-sm font-medium">{p.name.split(' ').slice(1).join(' ')}</span>
              {p.id === player?.id && <span className="text-xs bg-brand-blue px-2 py-0.5 rounded-full text-white font-bold ml-auto">You</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 text-center">
        <p className="text-4xl">⚽ 🏆 ⚽</p>
        <p className="text-white/40 text-sm mt-2">Football Championship · 4 Rounds · 100 Points</p>
      </div>
    </div>
  );
}
