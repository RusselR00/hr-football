import React, { useState, useEffect } from 'react';

const LABELS = ['A','B','C','D'];

function QuizTab() {
  const [questions, setQuestions] = useState([]);
  const [adding, setAdding]       = useState(false);
  const [form, setForm]           = useState({ question:'', opt_a:'', opt_b:'', opt_c:'', opt_d:'', answer: 0 });
  const [saving, setSaving]       = useState(false);

  const load = () => fetch('/api/questions').then(r=>r.json()).then(setQuestions);
  useEffect(() => { load(); }, []);

  const toggle = async (q) => {
    await fetch(`/api/questions/${q.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ active: q.active ? 0 : 1 }) });
    load();
  };
  const remove = async (id) => {
    if (!confirm('Delete this question?')) return;
    await fetch(`/api/questions/${id}`, { method:'DELETE' });
    load();
  };
  const save = async () => {
    if (!form.question || !form.opt_a || !form.opt_b || !form.opt_c || !form.opt_d) return;
    setSaving(true);
    await fetch('/api/questions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
    setSaving(false);
    setAdding(false);
    setForm({ question:'', opt_a:'', opt_b:'', opt_c:'', opt_d:'', answer: 0 });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white font-bold text-base">Quiz Questions</p>
          <p className="text-white/40 text-xs">{questions.filter(q=>q.active).length} active · {questions.length} total</p>
        </div>
        <button onClick={() => setAdding(!adding)}
          className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl text-sm btn-press hover:bg-blue-500">
          {adding ? '✕ Cancel' : '+ Add Question'}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="bg-white/5 border border-white/20 rounded-2xl p-4 mb-4 space-y-3">
          <textarea
            placeholder="Question text…"
            value={form.question}
            onChange={e => setForm(f=>({...f, question: e.target.value}))}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
            rows={2}
          />
          <div className="grid grid-cols-2 gap-2">
            {['opt_a','opt_b','opt_c','opt_d'].map((k,i) => (
              <input key={k} placeholder={`Option ${LABELS[i]}`} value={form[k]}
                onChange={e => setForm(f=>({...f,[k]:e.target.value}))}
                className="bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-white/50 text-xs font-semibold">Correct answer:</p>
            {LABELS.map((l,i) => (
              <button key={i} onClick={() => setForm(f=>({...f, answer: i}))}
                className={`w-8 h-8 rounded-lg font-black text-sm btn-press border ${form.answer === i ? 'bg-green-500 border-green-400 text-white' : 'bg-white/10 border-white/20 text-white/60'}`}>
                {l}
              </button>
            ))}
          </div>
          <button onClick={save} disabled={saving}
            className="w-full bg-green-600 text-white font-black py-2.5 rounded-xl text-sm btn-press disabled:opacity-50">
            {saving ? 'Saving…' : '✓ Save Question'}
          </button>
        </div>
      )}

      {/* Question list */}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {questions.map((q, i) => (
          <div key={q.id} className={`rounded-2xl border p-3 transition-all ${q.active ? 'bg-white/10 border-white/20' : 'bg-white/3 border-white/10 opacity-50'}`}>
            <div className="flex items-start gap-2">
              <span className="text-white/30 text-xs font-bold w-5 flex-shrink-0 pt-0.5">#{i+1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold leading-snug">{q.question}</p>
                <div className="grid grid-cols-2 gap-x-3 mt-1.5">
                  {[q.opt_a, q.opt_b, q.opt_c, q.opt_d].map((opt, idx) => (
                    <p key={idx} className={`text-xs py-0.5 ${idx === q.answer ? 'text-green-400 font-bold' : 'text-white/40'}`}>
                      {LABELS[idx]}: {opt}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={() => toggle(q)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold btn-press ${q.active ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-white/10 text-white/40 border border-white/10'}`}>
                  {q.active ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => remove(q.id)}
                  className="px-2 py-1 rounded-lg text-xs font-bold bg-red-600/20 text-red-400 border border-red-500/20 btn-press">
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GuessTab() {
  const [players, setPlayers] = useState([]);
  const [adding, setAdding]   = useState(false);
  const [form, setForm]       = useState({ answer:'', clue1:'', clue2:'', clue3:'', clue4:'' });
  const [saving, setSaving]   = useState(false);

  const load = () => fetch('/api/guess-players').then(r=>r.json()).then(setPlayers);
  useEffect(() => { load(); }, []);

  const toggle = async (p) => {
    await fetch(`/api/guess-players/${p.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ active: p.active ? 0 : 1 }) });
    load();
  };
  const remove = async (id) => {
    if (!confirm('Delete this player?')) return;
    await fetch(`/api/guess-players/${id}`, { method:'DELETE' });
    load();
  };
  const save = async () => {
    if (!form.answer || !form.clue1) return;
    setSaving(true);
    await fetch('/api/guess-players', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) });
    setSaving(false);
    setAdding(false);
    setForm({ answer:'', clue1:'', clue2:'', clue3:'', clue4:'' });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white font-bold text-base">Guess the Player</p>
          <p className="text-white/40 text-xs">{players.filter(p=>p.active).length} active · {players.length} total</p>
        </div>
        <button onClick={() => setAdding(!adding)}
          className="bg-blue-600 text-white font-bold px-4 py-2 rounded-xl text-sm btn-press hover:bg-blue-500">
          {adding ? '✕ Cancel' : '+ Add Player'}
        </button>
      </div>

      {adding && (
        <div className="bg-white/5 border border-white/20 rounded-2xl p-4 mb-4 space-y-2">
          <input placeholder="Player name (answer) e.g. Lionel Messi" value={form.answer}
            onChange={e => setForm(f=>({...f, answer: e.target.value}))}
            className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          {['clue1','clue2','clue3','clue4'].map((k,i) => (
            <input key={k} placeholder={`Clue ${i+1}${i===0?' (required)':' (optional)'}`} value={form[k]}
              onChange={e => setForm(f=>({...f,[k]:e.target.value}))}
              className="w-full bg-white/10 border border-white/20 text-white placeholder-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          ))}
          <button onClick={save} disabled={saving}
            className="w-full bg-green-600 text-white font-black py-2.5 rounded-xl text-sm btn-press disabled:opacity-50">
            {saving ? 'Saving…' : '✓ Save Player'}
          </button>
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {players.map((p, i) => (
          <div key={p.id} className={`rounded-2xl border p-3 transition-all ${p.active ? 'bg-white/10 border-white/20' : 'bg-white/3 border-white/10 opacity-50'}`}>
            <div className="flex items-start gap-2">
              <span className="text-white/30 text-xs font-bold w-5 flex-shrink-0 pt-0.5">#{i+1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-green-400 font-black text-sm">Answer: {p.answer}</p>
                <div className="mt-1 space-y-0.5">
                  {[p.clue1, p.clue2, p.clue3, p.clue4].filter(Boolean).map((c,ci) => (
                    <p key={ci} className="text-white/50 text-xs">Clue {ci+1}: {c}</p>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={() => toggle(p)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold btn-press ${p.active ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-white/10 text-white/40 border border-white/10'}`}>
                  {p.active ? 'ON' : 'OFF'}
                </button>
                <button onClick={() => remove(p.id)}
                  className="px-2 py-1 rounded-lg text-xs font-bold bg-red-600/20 text-red-400 border border-red-500/20 btn-press">
                  ✕
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QuestionManager() {
  const [tab, setTab] = useState('quiz');
  return (
    <div className="bg-white/10 border border-white/20 rounded-2xl p-5">
      <p className="text-white/60 text-sm font-semibold mb-4">⚙️ QUESTION SETUP</p>
      <div className="flex gap-2 mb-5">
        <button onClick={() => setTab('quiz')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold btn-press transition-all ${tab==='quiz' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}>
          ⚽ Quiz Questions
        </button>
        <button onClick={() => setTab('guess')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold btn-press transition-all ${tab==='guess' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}>
          🕵️ Guess Players
        </button>
      </div>
      {tab === 'quiz'  && <QuizTab />}
      {tab === 'guess' && <GuessTab />}
    </div>
  );
}
