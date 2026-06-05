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

// ─── Game Data ────────────────────────────────────────────────────────────────

const QUIZ_QUESTIONS = [
  { q: 'Which country won the 2022 FIFA World Cup?',          options: ['France','Argentina','Brazil','Germany'],           answer: 1 },
  { q: 'Who has won the most Ballon d\'Or awards?',           options: ['Cristiano Ronaldo','Zinedine Zidane','Lionel Messi','Ronaldo Nazário'], answer: 2 },
  { q: 'Which club is known as "The Reds"?',                  options: ['Manchester United','Arsenal','Bayern Munich','Liverpool'], answer: 3 },
  { q: 'Who scored the infamous "Hand of God" goal?',         options: ['Pelé','Diego Maradona','Ronaldo','Zidane'],         answer: 1 },
  { q: 'How many players are on the field per team?',         options: ['9','10','11','12'],                                  answer: 2 },
  { q: 'Which country has won the most FIFA World Cups?',     options: ['Germany','Italy','Argentina','Brazil'],              answer: 3 },
  { q: 'Who is the all-time top scorer in World Cup history?',options: ['Ronaldo','Pelé','Miroslav Klose','Just Fontaine'],  answer: 2 },
  { q: 'Which club has won the most Champions League titles?', options: ['Barcelona','AC Milan','Real Madrid','Bayern Munich'], answer: 2 },
  { q: 'In which year was the first FIFA World Cup held?',    options: ['1926','1930','1934','1938'],                         answer: 1 },
  { q: 'Which player is nicknamed "The Egyptian King"?',      options: ['Riyad Mahrez','Mo Salah','Sadio Mané','Hakim Ziyech'], answer: 1 },
  { q: 'What is the duration of a standard football match?',  options: ['80 minutes','90 minutes','100 minutes','120 minutes'], answer: 1 },
  { q: 'Which country hosted the 2018 FIFA World Cup?',       options: ['Brazil','Germany','Russia','Qatar'],                 answer: 2 },
];

const GUESS_PLAYERS = [
  { clues: ['Born in Madeira, Portugal 🇵🇹','Plays for Al Nassr','Won 5 Champions League titles','Scored 700+ career goals'], answer: 'Cristiano Ronaldo' },
  { clues: ['Born in Rosario, Argentina 🇦🇷','Plays for Inter Miami','Won the 2022 World Cup','Has 8 Ballon d\'Or awards'], answer: 'Lionel Messi' },
  { clues: ['Brazilian 🇧🇷','Plays for Al-Hilal','Wears the number 10','Best friends with Messi & Suárez'], answer: 'Neymar Jr' },
  { clues: ['English 🏴󠁧󠁢󠁥󠁮󠁧󠁿','Plays as a striker','Captains England\'s national team','Plays for Bayern Munich'], answer: 'Harry Kane' },
  { clues: ['Norwegian 🇳🇴','Known for clinical finishing','Broke Premier League scoring records','Plays for Manchester City'], answer: 'Erling Haaland' },
];


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
    penaltyRound: 0, penaltyTimer: null, penaltyKickAnswers: {}, penaltyShots: {},
  };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function persistScores() {
  if (game.sessionId) db.saveScores(game.sessionId, game.players);
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
  io.emit('quiz:reveal', { correctIndex: q.answer, correct });
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

// ─── Penalty ──────────────────────────────────────────────────────────────────

function startPenaltyRound() {
  game.phase = 'penalty';
  game.penaltyRound = 0;
  game.penaltyShots = {};
  Object.keys(game.players).forEach(sid => {
    game.penaltyShots[sid] = [];
    game.players[sid].penaltyGoals = 0;
  });
  sendPenaltyKick();
}

function sendPenaltyKick() {
  if (game.penaltyRound >= 5) { endPenaltyRound(); return; }
  game.penaltyKickAnswers = {};
  io.emit('penalty:kick', { round: game.penaltyRound + 1, total: 5, timeLimit: 8 });
  clearTimeout(game.penaltyTimer);
  game.penaltyTimer = setTimeout(resolvePenaltyKick, 8000);
}

function resolvePenaltyKick() {
  clearTimeout(game.penaltyTimer);
  const results = {};
  Object.keys(game.players).forEach(sid => {
    const dir = game.penaltyKickAnswers[sid] ?? Math.floor(Math.random() * 3);
    const gkDir = Math.floor(Math.random() * 3);
    const goal = dir !== gkDir;
    game.penaltyShots[sid].push({ dir, gkDir, goal });
    if (goal) game.players[sid].penaltyGoals = (game.players[sid].penaltyGoals || 0) + 1;
    results[sid] = { dir, goalkeeperDir: gkDir, goal };
  });
  if (game.penaltyRound === 4) {
    Object.entries(game.players).forEach(([sid]) => {
      const pts = (game.players[sid].penaltyGoals || 0) * 200;
      game.players[sid].score += pts;
      game.players[sid].roundScores.penalty = pts;
    });
  }
  io.emit('penalty:result', { results, round: game.penaltyRound + 1 });
  broadcastLeaderboard();
  game.penaltyRound++;
  setTimeout(sendPenaltyKick, 3000);
}

function endPenaltyRound() {
  const lb = getLeaderboard();
  const winner = lb[0];
  if (game.sessionId) db.endSession(game.sessionId, winner?.name, winner?.score);
  io.emit('game:winner', { leaderboard: lb, winner });
  game.phase = 'winner';
  persistScores();
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

  socket.on('host:start-quiz',    safe(() => { if (socket.id === game.hostId && game.phase === 'lobby')      startQuiz(); }));
  socket.on('host:start-guess',   safe(() => { if (socket.id === game.hostId && game.phase === 'quiz-done')  startGuessPlayer(); }));
  socket.on('host:start-penalty', safe(() => { if (socket.id === game.hostId && game.phase === 'guess-done') startPenaltyRound(); }));

  socket.on('host:skip', safe(() => {
    if (socket.id !== game.hostId) return;
    if (game.phase === 'quiz')         { clearTimeout(game.quizTimer);  revealQuizAnswer();   }
    if (game.phase === 'guess-player') { clearTimeout(game.guessTimer); revealGuessAnswer();   }
    if (game.phase === 'penalty')      { clearTimeout(game.penaltyTimer); resolvePenaltyKick(); }
  }));

  socket.on('host:reset', safe(() => {
    if (socket.id !== game.hostId) return;
    if (game.phase !== 'winner' && game.phase !== 'lobby') {
      socket.emit('host:error', { message: 'Cannot reset while a game is in progress.' });
      return;
    }
    const hostId = socket.id;
    game = createFreshGame();
    game.hostId = hostId;
    io.emit('game:reset');
    console.log('Game reset by host');
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
    if (!game.penaltyKickAnswers) game.penaltyKickAnswers = {};
    game.penaltyKickAnswers[socket.id] = direction;
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
