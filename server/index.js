const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const QRCode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ─── Game Data ────────────────────────────────────────────────────────────────

const QUIZ_QUESTIONS = [
  { q: 'Which country won the 2022 FIFA World Cup?', options: ['France', 'Argentina', 'Brazil', 'Germany'], answer: 1 },
  { q: 'Who has won the most Ballon d\'Or awards?', options: ['Cristiano Ronaldo', 'Zinedine Zidane', 'Lionel Messi', 'Ronaldo Nazário'], answer: 2 },
  { q: 'Which club is known as "The Reds"?', options: ['Manchester United', 'Arsenal', 'Bayern Munich', 'Liverpool'], answer: 3 },
  { q: 'Who scored the infamous "Hand of God" goal?', options: ['Pelé', 'Diego Maradona', 'Ronaldo', 'Zidane'], answer: 1 },
  { q: 'How many players are on the field per team?', options: ['9', '10', '11', '12'], answer: 2 },
  { q: 'Which country has won the most FIFA World Cups?', options: ['Germany', 'Italy', 'Argentina', 'Brazil'], answer: 3 },
  { q: 'Who is the all-time top scorer in World Cup history?', options: ['Ronaldo', 'Pelé', 'Miroslav Klose', 'Just Fontaine'], answer: 2 },
  { q: 'Which club has won the most UEFA Champions League titles?', options: ['Barcelona', 'AC Milan', 'Real Madrid', 'Bayern Munich'], answer: 2 },
  { q: 'In which year was the first FIFA World Cup held?', options: ['1926', '1930', '1934', '1938'], answer: 1 },
  { q: 'Which player is nicknamed "The Egyptian King"?', options: ['Riyad Mahrez', 'Mo Salah', 'Sadio Mané', 'Hakim Ziyech'], answer: 1 },
  { q: 'What is the duration of a standard football match?', options: ['80 minutes', '90 minutes', '100 minutes', '120 minutes'], answer: 1 },
  { q: 'Which country hosted the 2018 FIFA World Cup?', options: ['Brazil', 'Germany', 'Russia', 'Qatar'], answer: 2 },
];

const GUESS_PLAYERS = [
  {
    clues: ['I was born in Madeira, Portugal 🇵🇹', 'I play for Al Nassr', 'I have won 5 Champions League titles', 'I scored 700+ career goals'],
    answer: 'Cristiano Ronaldo',
    silhouette: '⚽'
  },
  {
    clues: ['I was born in Rosario, Argentina 🇦🇷', 'I play for Inter Miami', 'I won the 2022 World Cup', 'I have 8 Ballon d\'Or awards'],
    answer: 'Lionel Messi',
    silhouette: '⚽'
  },
  {
    clues: ['I am Brazilian 🇧🇷', 'I play for Al-Hilal', 'I wear the number 10', 'I am friends with Messi & Suárez'],
    answer: 'Neymar Jr',
    silhouette: '⚽'
  },
  {
    clues: ['I am English 🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'I play as a striker', 'I captain England\'s national team', 'I play for Bayern Munich'],
    answer: 'Harry Kane',
    silhouette: '⚽'
  },
  {
    clues: ['I am Norwegian 🇳🇴', 'I am known for my clinical finishing', 'I broke Premier League scoring records', 'I play for Manchester City'],
    answer: 'Erling Haaland',
    silhouette: '⚽'
  },
];

const PREDICT_MATCHES = [
  { home: 'Real Madrid', away: 'Barcelona', homeFlag: '🇪🇸', awayFlag: '🇪🇸', homeKit: '#FFFFFF', awayKit: '#A50044' },
  { home: 'Brazil', away: 'Argentina', homeFlag: '🇧🇷', awayFlag: '🇦🇷', homeKit: '#FFE100', awayKit: '#74ACDF' },
  { home: 'Man City', away: 'Liverpool', homeFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', awayFlag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', homeKit: '#6CABDD', awayKit: '#C8102E' },
];

// ─── Game State ───────────────────────────────────────────────────────────────

let game = createFreshGame();

function createFreshGame() {
  return {
    phase: 'lobby',           // lobby | quiz | guess-player | predict | penalty | leaderboard | winner
    players: {},              // socketId -> { name, score, roundScores, penaltyGoals }
    hostId: null,
    roomCode: 'DEEP24',
    // quiz
    quizIndex: 0,
    quizTimer: null,
    quizAnswers: {},          // socketId -> { optionIndex, timeMs }
    // guess-player
    guessIndex: 0,
    guessClueIndex: 0,
    guessTimer: null,
    guessAnswers: {},
    // predict
    predictIndex: 0,
    predictAnswers: {},       // socketId -> { home: n, away: n }
    // penalty
    penaltyRound: 0,          // 0-4 (5 kicks)
    penaltyShots: {},         // socketId -> [{ dir, saved }]
    penaltyTimer: null,
    penaltyPhase: 'shoot',    // shoot | result
  };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function getLeaderboard() {
  return Object.values(game.players)
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

function broadcastLeaderboard() {
  io.emit('leaderboard', getLeaderboard());
}

// ─── Quiz Round ───────────────────────────────────────────────────────────────

function startQuiz() {
  game.phase = 'quiz';
  game.quizIndex = 0;
  game.quizAnswers = {};
  sendQuizQuestion();
}

function sendQuizQuestion() {
  if (game.quizIndex >= QUIZ_QUESTIONS.length) {
    endQuizRound();
    return;
  }
  const q = QUIZ_QUESTIONS[game.quizIndex];
  game.quizAnswers = {};
  const questionStart = Date.now();
  game.questionStart = questionStart;

  io.emit('quiz:question', {
    index: game.quizIndex,
    total: QUIZ_QUESTIONS.length,
    question: q.q,
    options: q.options,
    timeLimit: 20,
  });

  clearTimeout(game.quizTimer);
  game.quizTimer = setTimeout(() => {
    revealQuizAnswer();
  }, 20000);
}

function revealQuizAnswer() {
  clearTimeout(game.quizTimer);
  const q = QUIZ_QUESTIONS[game.quizIndex];
  const correctIdx = q.answer;

  // Score players
  const correct = [];
  Object.entries(game.quizAnswers).forEach(([sid, { optionIndex, timeMs }]) => {
    if (optionIndex === correctIdx) {
      const speed = Math.max(0, 20000 - timeMs);
      const pts = Math.round(500 + (speed / 20000) * 500); // 500-1000 pts
      game.players[sid].score += pts;
      game.players[sid].roundScores.quiz = (game.players[sid].roundScores.quiz || 0) + pts;
      correct.push(sid);
    }
  });

  io.emit('quiz:reveal', { correctIndex: correctIdx, correct });
  broadcastLeaderboard();

  setTimeout(() => {
    game.quizIndex++;
    sendQuizQuestion();
  }, 3000);
}

function endQuizRound() {
  io.emit('round:end', { round: 'quiz', message: '⚽ Quiz Round Complete!' });
  broadcastLeaderboard();
}

// ─── Guess Player Round ───────────────────────────────────────────────────────

function startGuessPlayer() {
  game.phase = 'guess-player';
  game.guessIndex = 0;
  game.guessClueIndex = 0;
  game.guessAnswers = {};
  sendGuessPlayer();
}

function sendGuessPlayer() {
  if (game.guessIndex >= GUESS_PLAYERS.length) {
    endGuessRound();
    return;
  }
  game.guessClueIndex = 0;
  game.guessAnswers = {};
  revealGuessClue();
}

function revealGuessClue() {
  const player = GUESS_PLAYERS[game.guessIndex];
  const clues = player.clues.slice(0, game.guessClueIndex + 1);
  const maxPts = Math.max(200, 1000 - game.guessClueIndex * 200);

  io.emit('guess:clue', {
    index: game.guessIndex,
    total: GUESS_PLAYERS.length,
    clues,
    clueNum: game.guessClueIndex + 1,
    maxPoints: maxPts,
    canAnswer: true,
  });

  clearTimeout(game.guessTimer);
  game.guessTimer = setTimeout(() => {
    if (game.guessClueIndex < player.clues.length - 1) {
      game.guessClueIndex++;
      revealGuessClue();
    } else {
      revealGuessAnswer();
    }
  }, 8000);
}

function revealGuessAnswer() {
  clearTimeout(game.guessTimer);
  const player = GUESS_PLAYERS[game.guessIndex];
  io.emit('guess:reveal', { answer: player.answer, index: game.guessIndex });
  broadcastLeaderboard();

  setTimeout(() => {
    game.guessIndex++;
    sendGuessPlayer();
  }, 4000);
}

function endGuessRound() {
  io.emit('round:end', { round: 'guess', message: '🕵️ Guess the Player Complete!' });
  broadcastLeaderboard();
}

// ─── Predict Score Round ──────────────────────────────────────────────────────

function startPredictRound() {
  game.phase = 'predict';
  game.predictIndex = 0;
  game.predictAnswers = {};
  sendPredictMatch();
}

function sendPredictMatch() {
  if (game.predictIndex >= PREDICT_MATCHES.length) {
    endPredictRound();
    return;
  }
  game.predictAnswers = {};
  const match = PREDICT_MATCHES[game.predictIndex];
  io.emit('predict:match', {
    index: game.predictIndex,
    total: PREDICT_MATCHES.length,
    match,
    timeLimit: 30,
  });

  clearTimeout(game.predictTimer);
  game.predictTimer = setTimeout(() => {
    revealPredictResult();
  }, 30000);
}

function revealPredictResult() {
  clearTimeout(game.predictTimer);
  // Random actual score for fun
  const actualHome = Math.floor(Math.random() * 4);
  const actualAway = Math.floor(Math.random() * 3);

  const results = [];
  Object.entries(game.predictAnswers).forEach(([sid, { home, away }]) => {
    const diff = Math.abs(home - actualHome) + Math.abs(away - actualAway);
    let pts = 0;
    if (diff === 0) pts = 1000; // exact
    else if (diff === 1) pts = 500;
    else if (diff === 2) pts = 200;

    if (pts > 0) {
      game.players[sid].score += pts;
      game.players[sid].roundScores.predict = (game.players[sid].roundScores.predict || 0) + pts;
      results.push({ sid, pts });
    }
  });

  io.emit('predict:reveal', { actualHome, actualAway, results });
  broadcastLeaderboard();

  setTimeout(() => {
    game.predictIndex++;
    sendPredictMatch();
  }, 5000);
}

function endPredictRound() {
  io.emit('round:end', { round: 'predict', message: '🎯 Prediction Round Complete!' });
  broadcastLeaderboard();
}

// ─── Penalty Shootout ─────────────────────────────────────────────────────────

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
  if (game.penaltyRound >= 5) {
    endPenaltyRound();
    return;
  }
  game.penaltyKickAnswers = {};
  io.emit('penalty:kick', {
    round: game.penaltyRound + 1,
    total: 5,
    timeLimit: 8,
  });

  clearTimeout(game.penaltyTimer);
  game.penaltyTimer = setTimeout(() => {
    resolvePenaltyKick();
  }, 8000);
}

function resolvePenaltyKick() {
  clearTimeout(game.penaltyTimer);
  const results = {};

  Object.entries(game.players).forEach(([sid]) => {
    const shot = game.penaltyKickAnswers?.[sid]; // 0=left, 1=center, 2=right
    const goalkeeperDir = Math.floor(Math.random() * 3);
    const dir = shot !== undefined ? shot : Math.floor(Math.random() * 3);
    const goal = dir !== goalkeeperDir;

    game.penaltyShots[sid].push({ dir, goalkeeperDir, goal });
    if (goal) {
      game.players[sid].penaltyGoals = (game.players[sid].penaltyGoals || 0) + 1;
    }
    results[sid] = { dir, goalkeeperDir, goal };
  });

  // Score after all 5 kicks
  if (game.penaltyRound === 4) {
    Object.entries(game.players).forEach(([sid]) => {
      const goals = game.players[sid].penaltyGoals || 0;
      const pts = goals * 200;
      game.players[sid].score += pts;
      game.players[sid].roundScores.penalty = pts;
    });
  }

  io.emit('penalty:result', { results, round: game.penaltyRound + 1 });
  broadcastLeaderboard();

  game.penaltyRound++;
  setTimeout(() => {
    sendPenaltyKick();
  }, 3000);
}

function endPenaltyRound() {
  const lb = getLeaderboard();
  io.emit('game:winner', { leaderboard: lb, winner: lb[0] });
  game.phase = 'winner';
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('host:join', () => {
    game.hostId = socket.id;
    socket.join('host');
    socket.emit('host:state', {
      roomCode: game.roomCode,
      players: game.players,
      phase: game.phase,
    });
  });

  socket.on('player:join', ({ name }) => {
    if (!name || game.phase !== 'lobby') {
      socket.emit('join:error', { message: game.phase !== 'lobby' ? 'Game already started' : 'Name required' });
      return;
    }
    game.players[socket.id] = {
      id: socket.id,
      name: name.trim().substring(0, 20),
      score: 0,
      roundScores: {},
      penaltyGoals: 0,
      joinedAt: Date.now(),
    };
    socket.join('players');
    socket.emit('join:success', { player: game.players[socket.id], roomCode: game.roomCode });
    io.to('host').emit('host:player-joined', { players: game.players });
    broadcastLeaderboard();
    console.log(`Player joined: ${name}`);
  });

  // Host controls
  socket.on('host:start-quiz', () => { if (socket.id === game.hostId) startQuiz(); });
  socket.on('host:start-guess', () => { if (socket.id === game.hostId) startGuessPlayer(); });
  socket.on('host:start-predict', () => { if (socket.id === game.hostId) startPredictRound(); });
  socket.on('host:start-penalty', () => { if (socket.id === game.hostId) startPenaltyRound(); });
  socket.on('host:skip', () => {
    if (socket.id !== game.hostId) return;
    if (game.phase === 'quiz') { clearTimeout(game.quizTimer); revealQuizAnswer(); }
    if (game.phase === 'guess-player') { clearTimeout(game.guessTimer); revealGuessAnswer(); }
    if (game.phase === 'predict') { clearTimeout(game.predictTimer); revealPredictResult(); }
    if (game.phase === 'penalty') { clearTimeout(game.penaltyTimer); resolvePenaltyKick(); }
  });
  socket.on('host:reset', () => {
    if (socket.id === game.hostId) {
      game = createFreshGame();
      game.hostId = socket.id;
      io.emit('game:reset');
    }
  });

  // Player answers
  socket.on('quiz:answer', ({ optionIndex }) => {
    if (game.phase !== 'quiz' || game.quizAnswers[socket.id]) return;
    game.quizAnswers[socket.id] = { optionIndex, timeMs: Date.now() - game.questionStart };
    socket.emit('quiz:answered', { optionIndex });
  });

  socket.on('guess:answer', ({ answer }) => {
    if (game.phase !== 'guess-player' || game.guessAnswers[socket.id]) return;
    const player = GUESS_PLAYERS[game.guessIndex];
    const correct = answer.trim().toLowerCase().includes(player.answer.toLowerCase().split(' ')[1]?.toLowerCase() || player.answer.toLowerCase());
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
  });

  socket.on('predict:submit', ({ home, away }) => {
    if (game.phase !== 'predict' || game.predictAnswers[socket.id]) return;
    game.predictAnswers[socket.id] = { home: parseInt(home) || 0, away: parseInt(away) || 0 };
    socket.emit('predict:submitted');
  });

  socket.on('penalty:shoot', ({ direction }) => {
    if (game.phase !== 'penalty') return;
    if (!game.penaltyKickAnswers) game.penaltyKickAnswers = {};
    game.penaltyKickAnswers[socket.id] = direction; // 0,1,2
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    if (game.players[socket.id]) {
      delete game.players[socket.id];
      io.to('host').emit('host:player-joined', { players: game.players });
      broadcastLeaderboard();
    }
  });
});

// ─── QR Code API ──────────────────────────────────────────────────────────────

app.get('/api/qr', async (req, res) => {
  const url = req.query.url || `http://localhost:5173`;
  try {
    const qr = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: '#1565C0' } });
    res.json({ qr, roomCode: game.roomCode });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/state', (req, res) => {
  res.json({ phase: game.phase, players: Object.keys(game.players).length, roomCode: game.roomCode });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
