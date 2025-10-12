import { SQLiteDatabase } from "expo-sqlite";

export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export interface PracticeSession {
  id: number;
  level: JLPTLevel;
  title: string | null;
  content: string | null;
  content_output: string | null;
  content_text: string | null;
  created_at: number;
  updated_at: number;
}

export interface SessionWithPreview extends PracticeSession {
  content_preview?: string;
}

export interface PracticeSessionContent {
  output: string;
  text: string;
}

export async function createSession(
  db: SQLiteDatabase,
  level: JLPTLevel,
  content?: string
): Promise<number> {
  const query = `
    INSERT INTO practice_sessions (level, title, content, content_output, content_text, created_at, updated_at)
    VALUES (?, NULL, ?, ?, ?, ?, ?)
  `;

  const now = Date.now();
  const sanitizedContent = content ? content.trim() : null;
  const result = await db.runAsync(
    query,
    level,
    sanitizedContent,
    sanitizedContent,
    null,
    now,
    now
  );
  return result.lastInsertRowId;
}

export async function getSession(
  db: SQLiteDatabase,
  id: number
): Promise<PracticeSession | null> {
  const query = `
    SELECT id, level, title, content, content_output, content_text, created_at, updated_at
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
      content_output,
      content_text,
      created_at,
      updated_at,
      CASE
        WHEN COALESCE(content_output, content) IS NOT NULL THEN SUBSTR(COALESCE(content_output, content), 1, 100)
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
  content: PracticeSessionContent
): Promise<void> {
  const query = `
    UPDATE practice_sessions
    SET content = ?,
        content_output = ?,
        content_text = ?,
        updated_at = ?
    WHERE id = ?
  `;

  const now = Date.now();
  const output = content.output.trim();
  const text = content.text.trim();
  const normalizedOutput = output.length ? output : null;
  const normalizedText = text.length ? text : null;
  await db.runAsync(
    query,
    normalizedOutput,
    normalizedOutput,
    normalizedText,
    now,
    id
  );
}

export async function deleteSession(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  const query = `DELETE FROM practice_sessions WHERE id = ?`;
  await db.runAsync(query, [id]);
}
