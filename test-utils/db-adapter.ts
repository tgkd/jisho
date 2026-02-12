import type { SQLiteDatabase } from "expo-sqlite";
import path from "path";
import sqlite3 from "sqlite3";

type SqliteParams = any[] | Record<string, unknown> | undefined;

export const DB_PATH = path.join(
  __dirname,
  "../assets/db/db_20260211_114408.db"
);

export class ExpoSQLiteTestAdapter {
  private constructor(private readonly db: sqlite3.Database) {}

  static async open(dbPath: string): Promise<ExpoSQLiteTestAdapter> {
    return new Promise((resolve, reject) => {
      const database = new sqlite3.Database(
        dbPath,
        sqlite3.OPEN_READONLY,
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve(new ExpoSQLiteTestAdapter(database));
          }
        }
      );
    });
  }

  asSQLiteDatabase(): SQLiteDatabase {
    return this as unknown as SQLiteDatabase;
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async all<T = unknown>(sql: string, params?: SqliteParams): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params ?? [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  async get<T = unknown>(sql: string, params?: SqliteParams): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params ?? [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve((row as T) ?? null);
        }
      });
    });
  }

  async getAllAsync<T>(sql: string, params?: any, ...rest: any[]): Promise<T[]> {
    return this.execute<T[]>("all", sql, params, rest);
  }

  async getFirstAsync<T>(sql: string, params?: any, ...rest: any[]): Promise<T | null> {
    return this.execute<T | null>("get", sql, params, rest);
  }

  private execute<T>(
    method: "all" | "get",
    sql: string,
    params?: any,
    rest: any[] = []
  ): Promise<T> {
    const normalized = this.normalizeParams(params, rest);

    return new Promise((resolve, reject) => {
      (this.db as any)[method](sql, normalized, (err: Error | null, result: any) => {
        if (err) {
          reject(err);
        } else if (method === "get") {
          resolve((result ?? null) as T);
        } else {
          resolve(result as T);
        }
      });
    });
  }

  private normalizeParams(first: any, rest: any[]): SqliteParams {
    if (rest.length > 0) {
      return [first, ...rest];
    }

    if (Array.isArray(first)) {
      return first;
    }

    if (first && typeof first === "object") {
      return first as Record<string, unknown>;
    }

    if (first === undefined || first === null) {
      return [];
    }

    return [first];
  }
}
