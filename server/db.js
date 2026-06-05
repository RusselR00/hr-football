const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'game.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    winner_name TEXT,
    winner_score INTEGER
  );

  CREATE TABLE IF NOT EXISTS players (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    INTEGER NOT NULL,
    socket_id     TEXT NOT NULL,
    name          TEXT NOT NULL,
    score         INTEGER DEFAULT 0,
    quiz_score    INTEGER DEFAULT 0,
    guess_score   INTEGER DEFAULT 0,
    penalty_score INTEGER DEFAULT 0,
    penalty_goals INTEGER DEFAULT 0,
    joined_at     TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS quiz_questions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    question    TEXT NOT NULL,
    opt_a       TEXT NOT NULL,
    opt_b       TEXT NOT NULL,
    opt_c       TEXT NOT NULL,
    opt_d       TEXT NOT NULL,
    answer      INTEGER NOT NULL DEFAULT 0,
    explanation TEXT NOT NULL DEFAULT '',
    active      INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS guess_players (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    answer TEXT NOT NULL,
    clue1  TEXT NOT NULL,
    clue2  TEXT DEFAULT '',
    clue3  TEXT DEFAULT '',
    clue4  TEXT DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );
`);

// ─── Seed defaults if empty ────────────────────────────────────────────────

// Add explanation column if missing (safe migration)
try { db.exec(`ALTER TABLE quiz_questions ADD COLUMN explanation TEXT NOT NULL DEFAULT ''`); } catch(_) {}

const qCount = db.prepare('SELECT COUNT(*) as c FROM quiz_questions').get().c;
if (qCount === 0) {
  const insertQ = db.prepare(`INSERT INTO quiz_questions (question,opt_a,opt_b,opt_c,opt_d,answer,explanation,active,sort_order) VALUES (?,?,?,?,?,?,?,1,?)`);
  // [question, A, B, C, D, correct_index(0-based), explanation, sort_order]
  [
    ['Which country won the 2022 FIFA World Cup?','France','Argentina','Brazil','Germany',1,
     'Argentina beat France on penalties in the final in Qatar. It was Messi\'s first World Cup title.',1],
    ['Who has won the most Ballon d\'Or awards?','Cristiano Ronaldo','Zinedine Zidane','Lionel Messi','Ronaldo Nazário',2,
     'Lionel Messi has won 8 Ballon d\'Or awards — more than any other player in history.',2],
    ['Which club is known as "The Reds"?','Manchester United','Arsenal','Bayern Munich','Liverpool',3,
     'Liverpool FC are nicknamed The Reds due to their iconic all-red home kit, adopted in the 1960s.',3],
    ['Who scored the infamous "Hand of God" goal?','Pelé','Diego Maradona','Ronaldo','Zidane',1,
     'Maradona punched the ball into the net against England in the 1986 World Cup quarter-final, calling it "the hand of God".',4],
    ['How many players are on the field per team?','9','10','11','12',2,
     'Each team fields 11 players — 10 outfield players and 1 goalkeeper.',5],
    ['Which country has won the most FIFA World Cups?','Germany','Italy','Argentina','Brazil',3,
     'Brazil has won 5 World Cups: 1958, 1962, 1970, 1994 and 2002 — the most of any nation.',6],
    ['Who is the all-time top scorer in World Cup history?','Ronaldo','Pelé','Miroslav Klose','Just Fontaine',2,
     'Miroslav Klose scored 16 goals for Germany across 4 World Cups (2002–2014).',7],
    ['Which club has won the most Champions League titles?','Barcelona','AC Milan','Real Madrid','Bayern Munich',2,
     'Real Madrid have lifted the Champions League / European Cup a record 15 times.',8],
    ['In which year was the first FIFA World Cup held?','1926','1930','1934','1938',1,
     'The first World Cup was held in Uruguay in 1930. Uruguay won it, beating Argentina 4-2 in the final.',9],
    ['Which player is nicknamed "The Egyptian King"?','Riyad Mahrez','Mo Salah','Sadio Mané','Hakim Ziyech',1,
     'Mohamed Salah earned the nickname The Egyptian King after becoming Liverpool\'s all-time top scorer.',10],
    ['What is the duration of a standard football match?','80 minutes','90 minutes','100 minutes','120 minutes',1,
     'A standard match is 90 minutes: two 45-minute halves. 120 minutes (extra time) only applies in knockout rounds.',11],
    ['Which country hosted the 2018 FIFA World Cup?','Brazil','Germany','Russia','Qatar',2,
     'Russia hosted the 2018 World Cup. France won the tournament, beating Croatia 4-2 in the final.',12],
  ].forEach(r => insertQ.run(...r));
}

const gpCount = db.prepare('SELECT COUNT(*) as c FROM guess_players').get().c;
if (gpCount === 0) {
  const insertG = db.prepare(`INSERT INTO guess_players (answer,clue1,clue2,clue3,clue4,active,sort_order) VALUES (?,?,?,?,?,1,?)`);
  [
    ['Cristiano Ronaldo','Born in Madeira, Portugal 🇵🇹','Plays for Al Nassr','Won 5 Champions League titles','Scored 700+ career goals',1],
    ['Lionel Messi','Born in Rosario, Argentina 🇦🇷','Plays for Inter Miami','Won the 2022 World Cup','Has 8 Ballon d\'Or awards',2],
    ['Neymar Jr','Brazilian 🇧🇷','Plays for Al-Hilal','Wears the number 10','Best friends with Messi & Suárez',3],
    ['Harry Kane','English 🏴󠁧󠁢󠁥󠁮󠁧󠁿','Plays as a striker','Captains England\'s national team','Plays for Bayern Munich',4],
    ['Erling Haaland','Norwegian 🇳🇴','Known for clinical finishing','Broke Premier League scoring records','Plays for Manchester City',5],
  ].forEach(r => insertG.run(...r));
}

// ─── Session helpers ─────────────────────────────────────────────────────────

function startSession() {
  return db.prepare(`INSERT INTO sessions (started_at) VALUES (?)`).run(new Date().toISOString()).lastInsertRowid;
}
function endSession(id, name, score) {
  db.prepare(`UPDATE sessions SET ended_at=?,winner_name=?,winner_score=? WHERE id=?`).run(new Date().toISOString(), name, score, id);
}
function upsertPlayer(sessionId, socketId, name) {
  db.prepare(`INSERT INTO players (session_id,socket_id,name,joined_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING`).run(sessionId, socketId, name, new Date().toISOString());
}
function saveScores(sessionId, players) {
  const s = db.prepare(`UPDATE players SET score=?,quiz_score=?,guess_score=?,penalty_score=?,penalty_goals=? WHERE session_id=? AND socket_id=?`);
  for (const [sid, p] of Object.entries(players))
    s.run(p.score, p.roundScores?.quiz||0, p.roundScores?.guess||0, p.roundScores?.penalty||0, p.penaltyGoals||0, sessionId, sid);
}
function getSessionResults(id) {
  return db.prepare(`SELECT * FROM players WHERE session_id=? ORDER BY score DESC`).all(id);
}
function getAllSessions() {
  return db.prepare(`SELECT * FROM sessions ORDER BY id DESC`).all();
}

// ─── Quiz question helpers ────────────────────────────────────────────────────

function getActiveQuestions() {
  return db.prepare(`SELECT * FROM quiz_questions WHERE active=1 ORDER BY sort_order,id`).all();
}
function getAllQuestions() {
  return db.prepare(`SELECT * FROM quiz_questions ORDER BY sort_order,id`).all();
}
function addQuestion(q) {
  const maxOrder = db.prepare(`SELECT MAX(sort_order) as m FROM quiz_questions`).get().m || 0;
  return db.prepare(`INSERT INTO quiz_questions (question,opt_a,opt_b,opt_c,opt_d,answer,explanation,active,sort_order) VALUES (?,?,?,?,?,?,?,1,?)`)
    .run(q.question, q.opt_a, q.opt_b, q.opt_c, q.opt_d, q.answer, q.explanation||'', maxOrder + 1).lastInsertRowid;
}
function updateQuestion(id, fields) {
  const cols = Object.keys(fields).map(k => `${k}=?`).join(',');
  db.prepare(`UPDATE quiz_questions SET ${cols} WHERE id=?`).run(...Object.values(fields), id);
}
function deleteQuestion(id) {
  db.prepare(`DELETE FROM quiz_questions WHERE id=?`).run(id);
}
function setQuestionActive(id, active) {
  db.prepare(`UPDATE quiz_questions SET active=? WHERE id=?`).run(active ? 1 : 0, id);
}

// ─── Guess player helpers ─────────────────────────────────────────────────────

function getActivePlayers() {
  return db.prepare(`SELECT * FROM guess_players WHERE active=1 ORDER BY sort_order,id`).all();
}
function getAllGuessPLayers() {
  return db.prepare(`SELECT * FROM guess_players ORDER BY sort_order,id`).all();
}
function addGuessPlayer(p) {
  const maxOrder = db.prepare(`SELECT MAX(sort_order) as m FROM guess_players`).get().m || 0;
  return db.prepare(`INSERT INTO guess_players (answer,clue1,clue2,clue3,clue4,active,sort_order) VALUES (?,?,?,?,?,1,?)`)
    .run(p.answer, p.clue1, p.clue2||'', p.clue3||'', p.clue4||'', maxOrder+1).lastInsertRowid;
}
function updateGuessPlayer(id, fields) {
  const cols = Object.keys(fields).map(k => `${k}=?`).join(',');
  db.prepare(`UPDATE guess_players SET ${cols} WHERE id=?`).run(...Object.values(fields), id);
}
function deleteGuessPlayer(id) {
  db.prepare(`DELETE FROM guess_players WHERE id=?`).run(id);
}
function setGuessPlayerActive(id, active) {
  db.prepare(`UPDATE guess_players SET active=? WHERE id=?`).run(active ? 1 : 0, id);
}

module.exports = {
  startSession, endSession, upsertPlayer, saveScores, getSessionResults, getAllSessions,
  getActiveQuestions, getAllQuestions, addQuestion, updateQuestion, deleteQuestion, setQuestionActive,
  getActivePlayers, getAllGuessPLayers, addGuessPlayer, updateGuessPlayer, deleteGuessPlayer, setGuessPlayerActive,
};
