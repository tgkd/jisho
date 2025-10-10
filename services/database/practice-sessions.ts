import { SQLiteDatabase } from "expo-sqlite";

export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type MessageRole = "user" | "assistant";

export interface PracticeSession {
  id: number;
  level: JLPTLevel;
  title: string | null;
  created_at: number;
  updated_at: number;
}

export interface PracticeMessage {
  id: number;
  session_id: number;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export interface SessionWithPreview extends PracticeSession {
  message_count: number;
  last_message?: string;
}

export async function createSession(
  db: SQLiteDatabase,
  level: JLPTLevel
): Promise<number> {
  const query = `
    INSERT INTO practice_sessions (level, title, created_at, updated_at)
    VALUES (?, NULL, ?, ?)
  `;

  const now = Date.now();
  const result = await db.runAsync(query, level, now, now);
  return result.lastInsertRowId;
}

export async function getSession(
  db: SQLiteDatabase,
  id: number
): Promise<PracticeSession | null> {
  const query = `
    SELECT id, level, title, created_at, updated_at
    FROM practice_sessions
    WHERE id = ?
  `;

  const result = await db.getFirstAsync<PracticeSession>(query, [id]);
  return result || null;
}

export async function getAllSessions(
  db: SQLiteDatabase
): Promise<SessionWithPreview[]> {
  const query = `
    SELECT
      s.id,
      s.level,
      s.title,
      s.created_at,
      s.updated_at,
      COUNT(m.id) as message_count,
      (
        SELECT content
        FROM practice_messages
        WHERE session_id = s.id
        ORDER BY timestamp DESC
        LIMIT 1
      ) as last_message
    FROM practice_sessions s
    LEFT JOIN practice_messages m ON s.id = m.session_id
    GROUP BY s.id
    ORDER BY s.updated_at DESC
  `;

  const result = await db.getAllAsync<SessionWithPreview>(query);
  return result || [];
}

export async function updateSessionTimestamp(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  const query = `
    UPDATE practice_sessions
    SET updated_at = ?
    WHERE id = ?
  `;

  await db.runAsync(query, Date.now(), id);
}

export async function updateSessionTitle(
  db: SQLiteDatabase,
  id: number,
  title: string
): Promise<void> {
  const query = `
    UPDATE practice_sessions
    SET title = ?, updated_at = ?
    WHERE id = ?
  `;

  await db.runAsync(query, title, Date.now(), id);
}

export async function deleteSession(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  const query = `DELETE FROM practice_sessions WHERE id = ?`;
  await db.runAsync(query, [id]);
}

export async function saveMessage(
  db: SQLiteDatabase,
  sessionId: number,
  role: MessageRole,
  content: string
): Promise<number> {
  const messageQuery = `
    INSERT INTO practice_messages (session_id, role, content, timestamp)
    VALUES (?, ?, ?, ?)
  `;

  const timestamp = Date.now();
  const result = await db.runAsync(messageQuery, sessionId, role, content, timestamp);

  await updateSessionTimestamp(db, sessionId);

  return result.lastInsertRowId;
}

export async function getMessages(
  db: SQLiteDatabase,
  sessionId: number,
  limit?: number
): Promise<PracticeMessage[]> {
  let query = `
    SELECT id, session_id, role, content, timestamp
    FROM practice_messages
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `;

  if (limit) {
    query = `
      SELECT * FROM (
        SELECT id, session_id, role, content, timestamp
        FROM practice_messages
        WHERE session_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
      ) ORDER BY timestamp ASC
    `;
  }

  const params = limit ? [sessionId, limit] : [sessionId];
  const result = await db.getAllAsync<PracticeMessage>(query, params);
  return result || [];
}

export async function getMessageCount(
  db: SQLiteDatabase,
  sessionId: number
): Promise<number> {
  const query = `
    SELECT COUNT(*) as count
    FROM practice_messages
    WHERE session_id = ?
  `;

  const result = await db.getFirstAsync<{ count: number }>(query, [sessionId]);
  return result?.count || 0;
}
