import React, { useState } from 'react';
import Logo from '../components/Logo';

const AVATARS = ['🦈','🐟','🐠','🐡','🦑','🦞','🐙','🦀'];

export default function JoinScreen({ socket }) {
  const [name, setName]       = useState('');
  const [avatar, setAvatar]   = useState('🦈');
  const [error, setError]     = useState('');
  const [joining, setJoining] = useState(false);

  const join = () => {
    if (!name.trim()) { setError('Please enter your name!'); return; }
    setJoining(true);
    socket.emit('player:join', { name: `${avatar} ${name.trim()}` });
    socket.once('join:error', ({ message }) => {
      setError(message);
      setJoining(false);
    });
  };

  return (
    <div className="screen game-bg flex flex-col items-center justify-center px-5">
      {/* Logo */}
      <div className="text-center mb-7 animate-fade-in">
        <Logo height={88} className="mb-3 animate-bounce-in" />
        <h1 className="text-2xl font-black text-white tracking-tight leading-tight">Football Championship</h1>
        <p className="text-blue-400 font-bold text-base mt-1">2026 ⚽</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl animate-slide-up">
        <h2 className="text-xl font-black text-white mb-5 text-center">Join the Game</h2>

        {/* Avatar picker */}
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Pick your avatar</p>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {AVATARS.map(a => (
            <button
              key={a}
              onClick={() => setAvatar(a)}
              className={`text-3xl py-3 rounded-2xl transition-all btn-press border-2 ${
                avatar === a
                  ? 'border-blue-400 bg-blue-600/40 shadow-lg shadow-blue-500/40 scale-110'
                  : 'border-transparent bg-white/10 hover:bg-white/20'
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Name */}
        <input
          type="text"
          maxLength={18}
          inputMode="text"
          autoComplete="given-name"
          placeholder="Your name…"
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && join()}
          className="w-full bg-white/10 border-2 border-white/20 text-white placeholder-white/35 rounded-2xl px-4 py-4 text-lg font-semibold focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all mb-4"
        />

        {error && (
          <p className="text-red-400 text-sm mb-3 text-center font-semibold animate-fade-in">{error}</p>
        )}

        <button
          onClick={join}
          disabled={joining}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-black text-xl py-4 rounded-2xl shadow-xl shadow-blue-900/60 btn-press disabled:opacity-50 active:from-blue-700"
        >
          {joining ? '⏳ Joining…' : '🚀 Join Game'}
        </button>
      </div>

      <p className="text-white/25 text-xs mt-6 text-center">The Deep Seafood Company · HR Event 2026</p>
    </div>
  );
}
