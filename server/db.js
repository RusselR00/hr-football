const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'game.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    ended_at   TEXT,
    winner_name TEXT,
    winner_score INTEGER
  );

  CREATE TABLE IF NOT EXISTS players (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    socket_id  TEXT NOT NULL,
    name       TEXT NOT NULL,
    score      INTEGER DEFAULT 0,
    quiz_score    INTEGER DEFAULT 0,
    guess_score   INTEGER DEFAULT 0,
    predict_score INTEGER DEFAULT 0,
    penalty_score INTEGER DEFAULT 0,
    penalty_goals INTEGER DEFAULT 0,
    joined_at  TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );
`);

// ─── helpers ─────────────────────────────────────────────────────────────────

function startSession() {
  const { lastInsertRowid } = db.prepare(
    `INSERT INTO sessions (started_at) VALUES (?)`
  ).run(new Date().toISOString());
  return lastInsertRowid;
}

function endSession(sessionId, winnerName, winnerScore) {
  db.prepare(
    `UPDATE sessions SET ended_at = ?, winner_name = ?, winner_score = ? WHERE id = ?`
  ).run(new Date().toISOString(), winnerName, winnerScore, sessionId);
}

function upsertPlayer(sessionId, socketId, name) {
  db.prepare(
    `INSERT INTO players (session_id, socket_id, name, joined_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT DO NOTHING`
  ).run(sessionId, socketId, name, new Date().toISOString());
}

function saveScores(sessionId, players) {
  const stmt = db.prepare(`
    UPDATE players SET
      score         = ?,
      quiz_score    = ?,
      guess_score   = ?,
      predict_score = ?,
      penalty_score = ?,
      penalty_goals = ?
    WHERE session_id = ? AND socket_id = ?
  `);
  for (const [sid, p] of Object.entries(players)) {
    stmt.run(
      p.score,
      p.roundScores?.quiz    || 0,
      p.roundScores?.guess   || 0,
      p.roundScores?.predict || 0,
      p.roundScores?.penalty || 0,
      p.penaltyGoals || 0,
      sessionId, sid
    );
  }
}

function getSessionResults(sessionId) {
  return db.prepare(
    `SELECT * FROM players WHERE session_id = ? ORDER BY score DESC`
  ).all(sessionId);
}

function getAllSessions() {
  return db.prepare(`SELECT * FROM sessions ORDER BY id DESC`).all();
}

module.exports = { startSession, endSession, upsertPlayer, saveScores, getSessionResults, getAllSessions };
