import { SQLiteDatabase } from "expo-sqlite";

export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export interface PracticeSession {
  id: number;
  level: JLPTLevel;
  title: string | null;
  content: string | null;
  created_at: number;
  updated_at: number;
}

export interface SessionWithPreview extends PracticeSession {
  content_preview?: string;
}

export async function createSession(
  db: SQLiteDatabase,
  level: JLPTLevel,
  content?: string
): Promise<number> {
  const query = `
    INSERT INTO practice_sessions (level, title, content, created_at, updated_at)
    VALUES (?, NULL, ?, ?, ?)
  `;

  const now = Date.now();
  const result = await db.runAsync(query, level, content || null, now, now);
  return result.lastInsertRowId;
}

export async function getSession(
  db: SQLiteDatabase,
  id: number
): Promise<PracticeSession | null> {
  const query = `
    SELECT id, level, title, content, created_at, updated_at
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
      id,
      level,
      title,
      content,
      created_at,
      updated_at,
      CASE
        WHEN content IS NOT NULL THEN SUBSTR(content, 1, 100)
        ELSE NULL
      END as content_preview
    FROM practice_sessions
    ORDER BY updated_at DESC
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

export async function updateSessionContent(
  db: SQLiteDatabase,
  id: number,
  content: string
): Promise<void> {
  const query = `
    UPDATE practice_sessions
    SET content = ?, updated_at = ?
    WHERE id = ?
  `;

  await db.runAsync(query, content, Date.now(), id);
}

export async function deleteSession(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  const query = `DELETE FROM practice_sessions WHERE id = ?`;
  await db.runAsync(query, [id]);
}
