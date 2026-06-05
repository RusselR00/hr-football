import React, { useState } from 'react';

const AVATARS = ['🦈', '🐟', '🐠', '🐡', '🦑', '🦞', '🐙', '🦀'];

export default function JoinScreen({ socket }) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🦈');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  const join = () => {
    if (!name.trim()) { setError('Enter your name!'); return; }
    setJoining(true);
    socket.emit('player:join', { name: `${avatar} ${name.trim()}` });
    socket.once('join:error', ({ message }) => {
      setError(message);
      setJoining(false);
    });
  };

  return (
    <div className="game-bg min-h-screen flex flex-col items-center justify-center px-4">
      {/* Logo & Header */}
      <div className="text-center mb-8 animate-fade-in">
        <div className="text-6xl mb-3">⚽</div>
        <h1 className="text-3xl font-black text-white tracking-tight">
          Deep Seafood
        </h1>
        <p className="text-brand-blue-light font-semibold text-lg">Football Championship 2024</p>
      </div>

      {/* Join Card */}
      <div className="w-full max-w-sm bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-2xl animate-slide-up">
        <h2 className="text-xl font-bold text-white mb-5 text-center">Join the Game</h2>

        {/* Avatar Picker */}
        <p className="text-white/60 text-sm mb-2 font-medium">Pick your avatar</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {AVATARS.map(a => (
            <button
              key={a}
              onClick={() => setAvatar(a)}
              className={`text-2xl py-2 rounded-xl transition-all btn-press ${
                avatar === a
                  ? 'bg-brand-blue scale-110 shadow-lg shadow-blue-500/40'
                  : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Name Input */}
        <input
          type="text"
          maxLength={20}
          placeholder="Your name..."
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && join()}
          className="w-full bg-white/10 border border-white/30 text-white placeholder-white/40 rounded-xl px-4 py-3 text-lg font-semibold focus:outline-none focus:border-brand-blue-light focus:bg-white/20 transition-all mb-4"
        />

        {error && <p className="text-brand-red-light text-sm mb-3 text-center font-medium">{error}</p>}

        <button
          onClick={join}
          disabled={joining}
          className="w-full bg-gradient-to-r from-brand-blue to-brand-blue-light text-white font-black text-xl py-4 rounded-xl shadow-lg shadow-blue-900/50 hover:shadow-blue-700/60 transition-all btn-press disabled:opacity-50"
        >
          {joining ? '⏳ Joining...' : '🚀 Join Game'}
        </button>
      </div>

      <p className="text-white/30 text-xs mt-6">The Deep Seafood Company · HR Event 2024</p>
    </div>
  );
}
