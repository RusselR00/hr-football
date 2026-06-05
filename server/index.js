// ─── Crash guards (MUST be first) ────────────────────────────────────────────
process.on('uncaughtException',      err => console.error('UNCAUGHT EXCEPTION', err));
process.on('unhandledRejection',     err => console.error('UNHANDLED REJECTION', err));
process.on('SIGTERM', () => { console.log('SIGTERM received, staying alive'); });

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors   = require('cors');
const QRCode = require('qrcode');
const db     = require('./db');
const fs     = require('fs');
const path   = require('path');

// Ensure logs dir exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

const app    = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });

// ─── Game Data (loaded from DB at game start) ────────────────────────────────

let QUIZ_QUESTIONS = [];
let GUESS_PLAYERS  = [];

function loadGameData() {
  QUIZ_QUESTIONS = db.getActiveQuestions().map(r => ({
    id: r.id,
    q: r.question,
    options: [r.opt_a, r.opt_b, r.opt_c, r.opt_d],
    answer: r.answer,
    explanation: r.explanation || '',
  }));
  GUESS_PLAYERS = db.getActivePlayers().map(r => ({
    id: r.id,
    answer: r.answer,
    clues: [r.clue1, r.clue2, r.clue3, r.clue4].filter(Boolean),
  }));
  console.log(`Loaded ${QUIZ_QUESTIONS.length} questions, ${GUESS_PLAYERS.length} guess players`);
}


// ─── State ────────────────────────────────────────────────────────────────────

let game = createFreshGame();

function createFreshGame() {
  return {
    phase: 'lobby',
    players: {},
    hostId: null,
    roomCode: 'DEEP24',
    sessionId: null,
    quizIndex: 0, quizTimer: null, quizAnswers: {}, questionStart: 0,
    guessIndex: 0, guessClueIndex: 0, guessTimer: null, guessAnswers: {},
    penaltyShots: {}, penaltyDone: new Set(), penaltyTimer: null,
  };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function persistScores() {
  if (game.sessionId) db.saveScores(game.sessionId, game.players);
}

// ─── Screen sync ─────────────────────────────────────────────────────────────

function syncSocketToPhase(socket) {
  const p = game.phase;
  if (p === 'lobby') {
    socket.emit('game:reset');
    if (game.players[socket.id])
      socket.emit('join:success', { player: game.players[socket.id], roomCode: game.roomCode });
  } else if (p === 'quiz') {
    const q = QUIZ_QUESTIONS[game.quizIndex];
    if (q) socket.emit('quiz:question', { index: game.quizIndex, total: QUIZ_QUESTIONS.length, question: q.q, options: q.options, timeLimit: 20 });
  } else if (p === 'quiz-done') {
    socket.emit('round:end', { round: 'quiz', message: '⚽ Quiz Round Complete!' });
  } else if (p === 'guess-player') {
    const gp = GUESS_PLAYERS[game.guessIndex];
    if (gp) socket.emit('guess:clue', { index: game.guessIndex, total: GUESS_PLAYERS.length, clues: gp.clues.slice(0, game.guessClueIndex + 1), clueNum: game.guessClueIndex + 1, maxPoints: Math.max(200, 1000 - game.guessClueIndex * 200) });
  } else if (p === 'guess-done') {
    socket.emit('round:end', { round: 'guess', message: '🕵️ Guess the Player Complete!' });
  } else if (p === 'penalty') {
    socket.emit('penalty:start', { totalKicks: TOTAL_KICKS });
  } else if (p === 'winner') {
    const lb = getLeaderboard();
    socket.emit('game:winner', { leaderboard: lb, winner: lb[0] });
  }
}

function pushScreenToAll(screen) {
  const lb = getLeaderboard();
  if (screen === 'leaderboard') {
    io.emit('host:push-leaderboard', { leaderboard: lb });
  } else if (screen === 'sync') {
    io.sockets.sockets.forEach(s => {
      if (s.id !== game.hostId) syncSocketToPhase(s);
    });
    io.emit('leaderboard', lb);
  } else if (screen === 'winner') {
    io.emit('game:winner', { leaderboard: lb, winner: lb[0] });
  }
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

function getLeaderboard() {
  return Object.values(game.players)
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

function broadcastLeaderboard() {
  const lb = getLeaderboard();
  io.emit('leaderboard', lb);
  persistScores();
  return lb;
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

function startQuiz() {
  loadGameData();
  game.phase = 'quiz';
  game.quizIndex = 0;
  sendQuizQuestion();
}

function sendQuizQuestion() {
  if (game.quizIndex >= QUIZ_QUESTIONS.length) { endQuizRound(); return; }
  const q = QUIZ_QUESTIONS[game.quizIndex];
  game.quizAnswers = {};
  game.questionStart = Date.now();
  io.emit('quiz:question', { index: game.quizIndex, total: QUIZ_QUESTIONS.length, question: q.q, options: q.options, timeLimit: 20 });
  clearTimeout(game.quizTimer);
  game.quizTimer = setTimeout(revealQuizAnswer, 20000);
}

function revealQuizAnswer() {
  clearTimeout(game.quizTimer);
  const q = QUIZ_QUESTIONS[game.quizIndex];
  const correct = [];
  Object.entries(game.quizAnswers).forEach(([sid, { optionIndex, timeMs }]) => {
    if (optionIndex === q.answer) {
      const pts = Math.round(500 + (Math.max(0, 20000 - timeMs) / 20000) * 500);
      game.players[sid].score += pts;
      game.players[sid].roundScores.quiz = (game.players[sid].roundScores.quiz || 0) + pts;
      correct.push(sid);
    }
  });
  io.emit('quiz:reveal', { correctIndex: q.answer, correct, explanation: q.explanation || '' });
  broadcastLeaderboard();
  setTimeout(() => { game.quizIndex++; sendQuizQuestion(); }, 3000);
}

function endQuizRound() {
  game.phase = 'quiz-done';
  io.emit('round:end', { round: 'quiz', message: '⚽ Quiz Round Complete!' });
  broadcastLeaderboard();
}

// ─── Guess Player ─────────────────────────────────────────────────────────────

function startGuessPlayer() {
  game.phase = 'guess-player';
  game.guessIndex = 0;
  game.guessAnswers = {};
  sendGuessPlayer();
}

function sendGuessPlayer() {
  if (game.guessIndex >= GUESS_PLAYERS.length) { endGuessRound(); return; }
  game.guessClueIndex = 0;
  game.guessAnswers = {};
  revealGuessClue();
}

function revealGuessClue() {
  const player = GUESS_PLAYERS[game.guessIndex];
  const clues = player.clues.slice(0, game.guessClueIndex + 1);
  const maxPts = Math.max(200, 1000 - game.guessClueIndex * 200);
  io.emit('guess:clue', { index: game.guessIndex, total: GUESS_PLAYERS.length, clues, clueNum: game.guessClueIndex + 1, maxPoints: maxPts });
  clearTimeout(game.guessTimer);
  game.guessTimer = setTimeout(() => {
    if (game.guessClueIndex < player.clues.length - 1) { game.guessClueIndex++; revealGuessClue(); }
    else revealGuessAnswer();
  }, 8000);
}

function revealGuessAnswer() {
  clearTimeout(game.guessTimer);
  const player = GUESS_PLAYERS[game.guessIndex];
  io.emit('guess:reveal', { answer: player.answer, index: game.guessIndex });
  broadcastLeaderboard();
  setTimeout(() => { game.guessIndex++; sendGuessPlayer(); }, 4000);
}

function endGuessRound() {
  game.phase = 'guess-done';
  io.emit('round:end', { round: 'guess', message: '🕵️ Guess the Player Complete!' });
  broadcastLeaderboard();
}

// ─── Penalty (standalone per player) ─────────────────────────────────────────
// Each player plays their own 5 kicks independently at their own pace.
// Server resolves each kick immediately and replies only to that player.

const TOTAL_KICKS = 5;

function startPenaltyRound() {
  game.phase = 'penalty';
  game.penaltyShots = {};      // sid -> [{ dir, gkDir, goal }]
  game.penaltyDone  = new Set(); // sids who finished all kicks
  Object.keys(game.players).forEach(sid => {
    game.penaltyShots[sid] = [];
    game.players[sid].penaltyGoals = 0;
  });
  io.emit('penalty:start', { totalKicks: TOTAL_KICKS });
}

function checkAllDone() {
  const total = Object.keys(game.players).length;
  if (total === 0) return;
  io.to('host').emit('host:penalty-progress', {
    done: game.penaltyDone.size,
    total,
  });
  if (game.penaltyDone.size >= total) endPenaltyRound();
}

function endPenaltyRound() {
  clearTimeout(game.penaltyTimer);
  persistScores();
  const lb = getLeaderboard();
  const winner = lb[0];
  if (game.sessionId) db.endSession(game.sessionId, winner?.name, winner?.score);
  io.emit('game:winner', { leaderboard: lb, winner });
  game.phase = 'winner';
}

// ─── Sockets ──────────────────────────────────────────────────────────────────

// Wrap every handler so a single bad message can never crash the process
function safe(fn) {
  return (...args) => {
    try { fn(...args); }
    catch (err) { console.error('Socket handler error (non-fatal):', err); }
  };
}

io.on('connection', socket => {
  console.log('+ connected:', socket.id);

  socket.on('host:join', safe(() => {
    game.hostId = socket.id;
    socket.join('host');
    socket.emit('host:state', { roomCode: game.roomCode, players: game.players, phase: game.phase });
  }));

  socket.on('player:join', safe(({ name } = {}) => {
    if (!name?.trim()) { socket.emit('join:error', { message: 'Name required' }); return; }
    if (game.phase !== 'lobby') { socket.emit('join:error', { message: 'Game already started!' }); return; }

    if (!game.sessionId) game.sessionId = db.startSession();

    const playerName = name.trim().substring(0, 22);
    game.players[socket.id] = { id: socket.id, name: playerName, score: 0, roundScores: {}, penaltyGoals: 0, joinedAt: Date.now() };
    db.upsertPlayer(game.sessionId, socket.id, playerName);

    socket.join('players');
    socket.emit('join:success', { player: game.players[socket.id], roomCode: game.roomCode });
    io.to('host').emit('host:player-joined', { players: game.players });
    broadcastLeaderboard();
    console.log(`  player joined: ${playerName} (total: ${Object.keys(game.players).length})`);
  }));

  socket.on('host:push-screen', safe(({ screen } = {}) => {
    if (socket.id !== game.hostId) return;
    pushScreenToAll(screen);
  }));

  socket.on('host:start-quiz',    safe(() => { if (socket.id === game.hostId && game.phase === 'lobby')      startQuiz(); }));
  socket.on('host:start-guess',   safe(() => { if (socket.id === game.hostId && game.phase === 'quiz-done')  startGuessPlayer(); }));
  socket.on('host:start-penalty', safe(() => { if (socket.id === game.hostId && game.phase === 'guess-done') startPenaltyRound(); }));

  socket.on('host:skip', safe(() => {
    if (socket.id !== game.hostId) return;
    if (game.phase === 'quiz')         { clearTimeout(game.quizTimer);  revealQuizAnswer();  }
    if (game.phase === 'guess-player') { clearTimeout(game.guessTimer); revealGuessAnswer();  }
  }));

  // Only allowed from winner/lobby (normal end-of-game flow)
  socket.on('host:reset', safe(() => {
    if (socket.id !== game.hostId) return;
    if (game.phase !== 'winner' && game.phase !== 'lobby') return;
    const hostId = socket.id;
    game = createFreshGame();
    game.hostId = hostId;
    io.emit('game:reset');
    console.log('Game reset by host');
  }));

  // Force-reset: kill all timers, wipe state, back to lobby immediately
  socket.on('host:force-reset', safe(() => {
    if (socket.id !== game.hostId) return;
    clearTimeout(game.quizTimer);
    clearTimeout(game.guessTimer);
    const hostId = socket.id;
    game = createFreshGame();
    game.hostId = hostId;
    io.emit('game:reset');
    console.log('Game FORCE reset by host');
  }));

  // End game early: stop round, save scores, show winner screen
  socket.on('host:end-game', safe(() => {
    if (socket.id !== game.hostId) return;
    clearTimeout(game.quizTimer);
    clearTimeout(game.guessTimer);
    persistScores();
    const lb = getLeaderboard();
    const winner = lb[0];
    if (game.sessionId) db.endSession(game.sessionId, winner?.name, winner?.score);
    game.phase = 'winner';
    io.emit('game:winner', { leaderboard: lb, winner });
    console.log('Game ended early by host');
  }));

  socket.on('quiz:answer', safe(({ optionIndex } = {}) => {
    if (game.phase !== 'quiz' || game.quizAnswers[socket.id] || !game.players[socket.id]) return;
    game.quizAnswers[socket.id] = { optionIndex, timeMs: Date.now() - game.questionStart };
    socket.emit('quiz:answered', { optionIndex });
  }));

  socket.on('guess:answer', safe(({ answer } = {}) => {
    if (game.phase !== 'guess-player' || game.guessAnswers[socket.id] || !game.players[socket.id]) return;
    const target = GUESS_PLAYERS[game.guessIndex];
    const norm = s => s.toLowerCase().trim();
    const correct = norm(answer || '').includes(norm(target.answer.split(' ')[1] || target.answer)) ||
                    norm(target.answer).includes(norm(answer || ''));
    if (correct) {
      const maxPts = Math.max(200, 1000 - game.guessClueIndex * 200);
      game.players[socket.id].score += maxPts;
      game.players[socket.id].roundScores.guess = (game.players[socket.id].roundScores.guess || 0) + maxPts;
      game.guessAnswers[socket.id] = true;
      socket.emit('guess:correct', { pts: maxPts });
      clearTimeout(game.guessTimer);
      broadcastLeaderboard();
      setTimeout(revealGuessAnswer, 1500);
    } else {
      socket.emit('guess:wrong');
    }
  }));

  socket.on('penalty:shoot', safe(({ direction } = {}) => {
    if (game.phase !== 'penalty' || !game.players[socket.id]) return;
    const shots = game.penaltyShots[socket.id];
    if (!shots || shots.length >= TOTAL_KICKS) return; // already done

    const dir   = [0, 1, 2].includes(direction) ? direction : Math.floor(Math.random() * 3);
    const gkDir = Math.floor(Math.random() * 3);
    const goal  = dir !== gkDir;

    shots.push({ dir, gkDir, goal });
    if (goal) game.players[socket.id].penaltyGoals++;

    const kickNum = shots.length;
    socket.emit('penalty:kick-result', { dir, goalkeeperDir: gkDir, goal, kickNum, totalKicks: TOTAL_KICKS });

    if (kickNum >= TOTAL_KICKS) {
      // All kicks done — score this player
      const goals = game.players[socket.id].penaltyGoals;
      const pts   = goals * 200;
      game.players[socket.id].score += pts;
      game.players[socket.id].roundScores.penalty = pts;
      socket.emit('penalty:done', { goals, pts, totalKicks: TOTAL_KICKS });
      game.penaltyDone.add(socket.id);
      broadcastLeaderboard();
      checkAllDone();
    }
  }));

  socket.on('disconnect', safe(() => {
    console.log('- disconnected:', socket.id);
    if (game.players[socket.id]) {
      delete game.players[socket.id];
      io.to('host').emit('host:player-joined', { players: game.players });
      broadcastLeaderboard();
    }
  }));

  socket.on('error', err => console.error('Socket error (non-fatal):', err));
});

// ─── REST ─────────────────────────────────────────────────────────────────────

// ─── Question Management API ─────────────────────────────────────────────────

app.get('/api/questions', (req, res) => res.json(db.getAllQuestions()));
app.post('/api/questions', (req, res) => {
  try {
    const id = db.addQuestion(req.body);
    res.json({ id });
  } catch(e) { res.status(400).json({ error: e.message }); }
});
app.patch('/api/questions/:id', (req, res) => {
  db.updateQuestion(Number(req.params.id), req.body);
  res.json({ ok: true });
});
app.delete('/api/questions/:id', (req, res) => {
  db.deleteQuestion(Number(req.params.id));
  res.json({ ok: true });
});

app.get('/api/guess-players', (req, res) => res.json(db.getAllGuessPLayers()));
app.post('/api/guess-players', (req, res) => {
  try {
    const id = db.addGuessPlayer(req.body);
    res.json({ id });
  } catch(e) { res.status(400).json({ error: e.message }); }
});
app.patch('/api/guess-players/:id', (req, res) => {
  db.updateGuessPlayer(Number(req.params.id), req.body);
  res.json({ ok: true });
});
app.delete('/api/guess-players/:id', (req, res) => {
  db.deleteGuessPlayer(Number(req.params.id));
  res.json({ ok: true });
});

app.get('/api/state', (req, res) => {
  res.json({ phase: game.phase, players: Object.keys(game.players).length, roomCode: game.roomCode });
});

app.get('/api/results', (req, res) => {
  const sessions = db.getAllSessions();
  res.json(sessions);
});

app.get('/api/results/:sessionId', (req, res) => {
  const results = db.getSessionResults(Number(req.params.sessionId));
  res.json(results);
});

app.get('/api/network-ip', (req, res) => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  let ip = 'localhost';
  for (const iface of Object.values(nets)) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) { ip = alias.address; break; }
    }
    if (ip !== 'localhost') break;
  }
  res.json({ ip });
});

app.get('/api/qr', async (req, res) => {
  const url = req.query.url || 'http://localhost:5173';
  try {
    const qr = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#1565C0' } });
    res.json({ qr, roomCode: game.roomCode });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => console.log(`\n✅ Server ready on port ${PORT}\n   DB: ${require('path').join(__dirname, 'game.db')}\n`));
