import { SQLiteDatabase } from "expo-sqlite";

type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export interface Passage {
  id: number;
  level: JLPTLevel;
  title: string;
  content: string;
  translation?: string;
  created_at: number;
}

export interface PassageInput {
  level: string;
  title: string;
  content: string;
  translation?: string;
}

export async function getPassagesByLevel(
  db: SQLiteDatabase,
  level: string
): Promise<Passage[]> {
  const query = `
    SELECT id, level, title, content, translation, created_at
    FROM practice_passages
    WHERE level = ?
    ORDER BY created_at DESC
  `;

  const result = await db.getAllAsync<Passage>(query, [level]);
  return result || [];
}

export async function getPassageById(
  db: SQLiteDatabase,
  id: number
): Promise<Passage | null> {
  const query = `
    SELECT id, level, title, content, translation, created_at
    FROM practice_passages
    WHERE id = ?
  `;

  const result = await db.getFirstAsync<Passage>(query, [id]);
  return result || null;
}

export async function savePassage(
  db: SQLiteDatabase,
  passage: PassageInput
): Promise<number> {
  const query = `
    INSERT INTO practice_passages (level, title, content, translation, created_at)
    VALUES (?, ?, ?, ?, ?)
  `;

  const createdAt = Date.now();
  const result = await db.runAsync(
    query,
    passage.level,
    passage.title,
    passage.content,
    passage.translation || null,
    createdAt
  );

  return result.lastInsertRowId;
}

export async function deletePassage(
  db: SQLiteDatabase,
  id: number
): Promise<void> {
  const query = `DELETE FROM practice_passages WHERE id = ?`;
  await db.runAsync(query, [id]);
}

export async function getAllPassages(
  db: SQLiteDatabase
): Promise<Passage[]> {
  const query = `
    SELECT id, level, title, content, translation, created_at
    FROM practice_passages
    ORDER BY created_at DESC
  `;

  const result = await db.getAllAsync<Passage>(query);
  return result || [];
}
