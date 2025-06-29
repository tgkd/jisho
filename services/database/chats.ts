import { SQLiteDatabase } from "expo-sqlite";
import { DBChat, Chat } from "./types";

export async function getChats(
  db: SQLiteDatabase,
  limit = 50,
  offset = 0
): Promise<Chat[]> {
  try {
    const chats = await db.getAllAsync<DBChat>(
      `SELECT * FROM chats ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return chats.map((c) => ({
      ...c,
      createdAt: c.created_at,
    }));
  } catch (error) {
    console.error("Failed to get chats:", error);
    return [];
  }
}

export async function addChat(
  db: SQLiteDatabase,
  request: string,
  response: string
): Promise<Chat | null> {
  try {
    const res = await db.runAsync(
      "INSERT INTO chats (request, response, created_at) VALUES (?, ?, ?)",
      [request, response, new Date().toISOString()]
    );
    const createdChat = await db.getFirstAsync<DBChat>(
      "SELECT * FROM chats WHERE id = ?",
      [res.lastInsertRowId]
    );
    return createdChat
      ? {
          ...createdChat,
          createdAt: createdChat.created_at,
        }
      : null;
  } catch (error) {
    console.error("Failed to add chat:", error);
    return null;
  }
}

export async function removeChatById(
  db: SQLiteDatabase,
  chatId: number
): Promise<boolean> {
  try {
    await db.runAsync("DELETE FROM chats WHERE id = ?", [chatId]);
    return true;
  } catch (error) {
    console.error("Failed to remove chat:", error);
    return false;
  }
}

export async function clearChats(db: SQLiteDatabase): Promise<boolean> {
  try {
    await db.runAsync("DELETE FROM chats");
    return true;
  } catch (error) {
    console.error("Failed to clear chats:", error);
    return false;
  }
}