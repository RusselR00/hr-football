import React, { useState, useEffect } from 'react';

const LABELS = ['A', 'B', 'C', 'D'];

// ─── Shared helpers ───────────────────────────────────────────────────────────

function api(path, method = 'GET', body) {
  return fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }).then(r => r.json());
}

// ─── Quiz Question Row ────────────────────────────────────────────────────────

function QuizRow({ q, idx, onSave, onDelete, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState(null);
  const [saving, setSaving]   = useState(false);

  const startEdit = () => {
    setForm({ question: q.question, opt_a: q.opt_a, opt_b: q.opt_b, opt_c: q.opt_c, opt_d: q.opt_d, answer: q.answer, explanation: q.explanation || '' });
    setEditing(true);
  };

  const cancel = () => { setEditing(false); setForm(null); };

  const save = async () => {
    if (!form.question || !form.opt_a || !form.opt_b || !form.opt_c || !form.opt_d) return;
    setSaving(true);
    await api(`/api/questions/${q.id}`, 'PATCH', form);
    setSaving(false);
    setEditing(false);
    onSave();
  };

  const f = form || {};

  return (
    <div className={`rounded-2xl border transition-all ${q.active ? 'bg-white/8 border-white/20' : 'bg-white/3 border-white/10 opacity-50'}`}>
      {!editing ? (
        /* ── Read view ── */
        <div className="p-3 flex items-start gap-2">
          <span className="text-white/30 text-xs font-bold w-5 flex-shrink-0 mt-0.5">#{idx + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold leading-snug">{q.question}</p>
            <div className="grid grid-cols-2 gap-x-3 mt-1.5">
              {[q.opt_a, q.opt_b, q.opt_c, q.opt_d].map((opt, i) => (
                <p key={i} className={`text-xs py-0.5 ${i === q.answer ? 'text-green-400 font-bold' : 'text-white/40'}`}>
                  {LABELS[i]}: {opt}
                </p>
              ))}
            </div>
            {q.explanation && (
              <p className="text-blue-300/60 text-xs mt-1.5 leading-snug">💡 {q.explanation}</p>
            )}
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0 ml-1">
            <button onClick={startEdit}
              className="px-2 py-1 rounded-lg text-xs font-bold bg-blue-600/20 text-blue-300 border border-blue-500/20 btn-press hover:bg-blue-600/30">
              ✏️
            </button>
            <button onClick={() => onToggle(q)}
              className={`px-2 py-1 rounded-lg text-xs font-bold btn-press border ${q.active ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-white/10 text-white/40 border-white/10'}`}>
              {q.active ? 'ON' : 'OFF'}
            </button>
            <button onClick={() => onDelete(q.id)}
              className="px-2 py-1 rounded-lg text-xs font-bold bg-red-600/20 text-red-400 border border-red-500/20 btn-press">
              🗑
            </button>
          </div>
        </div>
      ) : (
        /* ── Edit view ── */
        <div className="p-3 space-y-2">
          <textarea
            placeholder="Question text…"
            value={f.question}
            onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-2">
            {['opt_a', 'opt_b', 'opt_c', 'opt_d'].map((k, i) => (
              <div key={k} className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black ${i === f.answer ? 'text-green-400' : 'text-white/30'}`}>
                  {LABELS[i]}
                </span>
                <input
                  value={f[k]}
                  onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-white/50 text-xs font-semibold flex-shrink-0">Correct:</p>
            {LABELS.map((l, i) => (
              <button key={i} onClick={() => setForm(p => ({ ...p, answer: i }))}
                className={`w-8 h-8 rounded-lg font-black text-sm btn-press border ${f.answer === i ? 'bg-green-500 border-green-400 text-white' : 'bg-white/10 border-white/20 text-white/50'}`}>
                {l}
              </button>
            ))}
          </div>
          <textarea
            placeholder="💡 Explanation / fun fact shown after reveal (optional)…"
            value={f.explanation}
            onChange={e => setForm(p => ({ ...p, explanation: e.target.value }))}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex-1 bg-green-600 text-white font-black py-2 rounded-xl text-sm btn-press disabled:opacity-50">
              {saving ? 'Saving…' : '✓ Save'}
            </button>
            <button onClick={cancel}
              className="flex-1 bg-white/10 text-white/60 font-semibold py-2 rounded-xl text-sm btn-press">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Question Form ────────────────────────────────────────────────────────

function NewQuizForm({ onSaved, onCancel }) {
  const [form, setForm] = useState({ question: '', opt_a: '', opt_b: '', opt_c: '', opt_d: '', answer: 0, explanation: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.question || !form.opt_a || !form.opt_b || !form.opt_c || !form.opt_d) return;
    setSaving(true);
    await api('/api/questions', 'POST', form);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="bg-white/5 border border-blue-500/30 rounded-2xl p-4 space-y-2 mb-3">
      <p className="text-blue-300 text-xs font-bold uppercase tracking-wider">New Question</p>
      <textarea placeholder="Question text…" value={form.question}
        onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
        className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" rows={2} />
      <div className="grid grid-cols-2 gap-2">
        {['opt_a', 'opt_b', 'opt_c', 'opt_d'].map((k, i) => (
          <div key={k} className="relative">
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black ${i === form.answer ? 'text-green-400' : 'text-white/30'}`}>{LABELS[i]}</span>
            <input value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
              placeholder={`Option ${LABELS[i]}`}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <p className="text-white/50 text-xs font-semibold flex-shrink-0">Correct:</p>
        {LABELS.map((l, i) => (
          <button key={i} onClick={() => setForm(p => ({ ...p, answer: i }))}
            className={`w-8 h-8 rounded-lg font-black text-sm btn-press border ${form.answer === i ? 'bg-green-500 border-green-400 text-white' : 'bg-white/10 border-white/20 text-white/50'}`}>
            {l}
          </button>
        ))}
      </div>
      <textarea placeholder="💡 Explanation / fun fact (optional)…" value={form.explanation}
        onChange={e => setForm(p => ({ ...p, explanation: e.target.value }))}
        className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" rows={2} />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="flex-1 bg-green-600 text-white font-black py-2.5 rounded-xl text-sm btn-press disabled:opacity-50">
          {saving ? 'Saving…' : '✓ Add Question'}
        </button>
        <button onClick={onCancel}
          className="flex-1 bg-white/10 text-white/60 font-semibold py-2.5 rounded-xl text-sm btn-press">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Quiz Tab ─────────────────────────────────────────────────────────────────

function QuizTab() {
  const [questions, setQuestions] = useState([]);
  const [adding, setAdding]       = useState(false);

  const load = () => api('/api/questions').then(setQuestions);
  useEffect(() => { load(); }, []);

  const toggle = async q => { await api(`/api/questions/${q.id}`, 'PATCH', { active: q.active ? 0 : 1 }); load(); };
  const remove = async id => { if (!confirm('Delete this question?')) return; await api(`/api/questions/${id}`, 'DELETE'); load(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white font-bold text-sm">Quiz Questions</p>
          <p className="text-white/40 text-xs">{questions.filter(q => q.active).length} active · {questions.length} total</p>
        </div>
        <button onClick={() => setAdding(a => !a)}
          className={`px-4 py-2 rounded-xl text-sm font-bold btn-press ${adding ? 'bg-white/10 text-white/60' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
          {adding ? '✕ Cancel' : '+ New Question'}
        </button>
      </div>

      {adding && <NewQuizForm onSaved={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />}

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {questions.map((q, i) => (
          <QuizRow key={q.id} q={q} idx={i} onSave={load} onDelete={remove} onToggle={toggle} />
        ))}
        {questions.length === 0 && <p className="text-white/30 text-sm text-center py-8">No questions yet — add one above.</p>}
      </div>
    </div>
  );
}

// ─── Guess Player Row ─────────────────────────────────────────────────────────

function GuessRow({ p, idx, onSave, onDelete, onToggle }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm]       = useState(null);
  const [saving, setSaving]   = useState(false);

  const startEdit = () => {
    setForm({ answer: p.answer, clue1: p.clue1, clue2: p.clue2 || '', clue3: p.clue3 || '', clue4: p.clue4 || '' });
    setEditing(true);
  };

  const save = async () => {
    if (!form.answer || !form.clue1) return;
    setSaving(true);
    await api(`/api/guess-players/${p.id}`, 'PATCH', form);
    setSaving(false);
    setEditing(false);
    onSave();
  };

  return (
    <div className={`rounded-2xl border transition-all ${p.active ? 'bg-white/8 border-white/20' : 'bg-white/3 border-white/10 opacity-50'}`}>
      {!editing ? (
        <div className="p-3 flex items-start gap-2">
          <span className="text-white/30 text-xs font-bold w-5 flex-shrink-0 mt-0.5">#{idx + 1}</span>
          <div className="flex-1 min-w-0">
            <p className="text-green-400 font-black text-sm">⚽ {p.answer}</p>
            <div className="mt-1 space-y-0.5">
              {[p.clue1, p.clue2, p.clue3, p.clue4].filter(Boolean).map((c, ci) => (
                <p key={ci} className="text-white/50 text-xs">Clue {ci + 1}: {c}</p>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0 ml-1">
            <button onClick={startEdit}
              className="px-2 py-1 rounded-lg text-xs font-bold bg-blue-600/20 text-blue-300 border border-blue-500/20 btn-press">✏️</button>
            <button onClick={() => onToggle(p)}
              className={`px-2 py-1 rounded-lg text-xs font-bold btn-press border ${p.active ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-white/10 text-white/40 border-white/10'}`}>
              {p.active ? 'ON' : 'OFF'}
            </button>
            <button onClick={() => onDelete(p.id)}
              className="px-2 py-1 rounded-lg text-xs font-bold bg-red-600/20 text-red-400 border border-red-500/20 btn-press">🗑</button>
          </div>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          <input placeholder="Player name (answer)" value={form.answer}
            onChange={e => setForm(p => ({ ...p, answer: e.target.value }))}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          {['clue1', 'clue2', 'clue3', 'clue4'].map((k, i) => (
            <input key={k} placeholder={`Clue ${i + 1}${i === 0 ? ' (required)' : ' (optional)'}`} value={form[k]}
              onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          ))}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex-1 bg-green-600 text-white font-black py-2 rounded-xl text-sm btn-press disabled:opacity-50">
              {saving ? 'Saving…' : '✓ Save'}
            </button>
            <button onClick={() => { setEditing(false); setForm(null); }}
              className="flex-1 bg-white/10 text-white/60 font-semibold py-2 rounded-xl text-sm btn-press">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Guess Tab ────────────────────────────────────────────────────────────────

function GuessTab() {
  const [players, setPlayers] = useState([]);
  const [adding, setAdding]   = useState(false);
  const [form, setForm]       = useState({ answer: '', clue1: '', clue2: '', clue3: '', clue4: '' });
  const [saving, setSaving]   = useState(false);

  const load = () => api('/api/guess-players').then(setPlayers);
  useEffect(() => { load(); }, []);

  const toggle = async p => { await api(`/api/guess-players/${p.id}`, 'PATCH', { active: p.active ? 0 : 1 }); load(); };
  const remove = async id => { if (!confirm('Delete this player?')) return; await api(`/api/guess-players/${id}`, 'DELETE'); load(); };
  const save   = async () => {
    if (!form.answer || !form.clue1) return;
    setSaving(true);
    await api('/api/guess-players', 'POST', form);
    setSaving(false);
    setAdding(false);
    setForm({ answer: '', clue1: '', clue2: '', clue3: '', clue4: '' });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white font-bold text-sm">Guess the Player</p>
          <p className="text-white/40 text-xs">{players.filter(p => p.active).length} active · {players.length} total</p>
        </div>
        <button onClick={() => setAdding(a => !a)}
          className={`px-4 py-2 rounded-xl text-sm font-bold btn-press ${adding ? 'bg-white/10 text-white/60' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
          {adding ? '✕ Cancel' : '+ New Player'}
        </button>
      </div>

      {adding && (
        <div className="bg-white/5 border border-blue-500/30 rounded-2xl p-4 space-y-2 mb-3">
          <p className="text-blue-300 text-xs font-bold uppercase tracking-wider">New Player</p>
          <input placeholder="Player name (the answer)" value={form.answer}
            onChange={e => setForm(p => ({ ...p, answer: e.target.value }))}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          {['clue1', 'clue2', 'clue3', 'clue4'].map((k, i) => (
            <input key={k} placeholder={`Clue ${i + 1}${i === 0 ? ' (required)' : ' (optional)'}`} value={form[k]}
              onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
          ))}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex-1 bg-green-600 text-white font-black py-2.5 rounded-xl text-sm btn-press disabled:opacity-50">
              {saving ? 'Saving…' : '✓ Add Player'}
            </button>
            <button onClick={() => setAdding(false)}
              className="flex-1 bg-white/10 text-white/60 font-semibold py-2.5 rounded-xl text-sm btn-press">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {players.map((p, i) => (
          <GuessRow key={p.id} p={p} idx={i} onSave={load} onDelete={remove} onToggle={toggle} />
        ))}
        {players.length === 0 && <p className="text-white/30 text-sm text-center py-8">No players yet — add one above.</p>}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function QuestionManager() {
  const [tab, setTab] = useState('quiz');
  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl p-5">
      <p className="text-white/60 text-sm font-semibold mb-4">⚙️ QUESTION SETUP</p>
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('quiz')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold btn-press ${tab === 'quiz' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}>
          ⚽ Quiz Questions
        </button>
        <button onClick={() => setTab('guess')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold btn-press ${tab === 'guess' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}>
          🕵️ Guess Players
        </button>
      </div>
      {tab === 'quiz'  && <QuizTab />}
      {tab === 'guess' && <GuessTab />}
    </div>
  );
}
