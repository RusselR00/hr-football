import React from 'react';

export default function LobbyScreen({ player, leaderboard }) {
  return (
    <div className="screen game-bg flex flex-col items-center justify-center px-5">
      {/* Confirmed */}
      <div className="text-center mb-7 animate-bounce-in">
        <div className="text-7xl mb-3">✅</div>
        <h1 className="text-3xl font-black text-white">You're In!</h1>
        <p className="text-blue-300 font-semibold text-lg mt-1">{player?.name}</p>
      </div>

      {/* Waiting card */}
      <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-5 mb-4 animate-fade-in text-center">
        <p className="text-white/50 text-sm font-semibold uppercase tracking-wider">Waiting for HR to start…</p>
        <div className="flex gap-1.5 justify-center mt-3">
          {[0,1,2].map(i => (
            <div key={i} className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      </div>

      {/* Player list */}
      <div className="w-full max-w-sm bg-white/5 border border-white/10 rounded-3xl p-4 animate-fade-in">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
          Players Joined ({leaderboard.length})
        </p>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {leaderboard.map(p => (
            <div key={p.id} className="flex items-center gap-3 py-1">
              <span className="text-xl flex-shrink-0">{p.name.split(' ')[0]}</span>
              <span className="text-white/70 text-sm font-medium truncate flex-1">
                {p.name.split(' ').slice(1).join(' ')}
              </span>
              {p.id === player?.id && (
                <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full text-white font-bold flex-shrink-0">You</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Rounds preview */}
      <div className="w-full max-w-sm mt-4 grid grid-cols-3 gap-2 animate-fade-in">
        {[
          { icon: '⚽', label: 'Quiz' },
          { icon: '🕵️', label: 'Guess' },
          { icon: '🥅', label: 'Penalty' },
        ].map(({ icon, label }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-2xl py-3 flex flex-col items-center gap-1">
            <span className="text-xl">{icon}</span>
            <span className="text-white/40 text-xs font-semibold">{label}</span>
          </div>
        ))}
      </div>

      <p className="text-white/20 text-xs mt-6 text-center">Deep Seafood Football Championship 2024</p>
    </div>
  );
}
