import type { SQLiteDatabase } from "expo-sqlite";
import { copyFileSync, mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import sqlite3 from "sqlite3";

type SqliteParams = any[] | Record<string, unknown> | undefined;

export const DB_PATH = path.join(
  __dirname,
  "../assets/db/jisho-seed.db"
);

export class ExpoSQLiteTestAdapter {
  private constructor(private readonly db: sqlite3.Database) {}

  static async open(
    dbPath: string,
    options: { readonly?: boolean } = { readonly: true }
  ): Promise<ExpoSQLiteTestAdapter> {
    const mode = options.readonly
      ? sqlite3.OPEN_READONLY
      : sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE;

    return new Promise((resolve, reject) => {
      const database = new sqlite3.Database(dbPath, mode, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(new ExpoSQLiteTestAdapter(database));
        }
      });
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

  async exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
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

  async runAsync(sql: string, params?: any, ...rest: any[]): Promise<{ lastInsertRowId: number; changes: number }> {
    const normalized = this.normalizeParams(params, rest);
    return new Promise((resolve, reject) => {
      this.db.run(sql, normalized, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve({ lastInsertRowId: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async execAsync(sql: string): Promise<void> {
    return this.exec(sql);
  }

  async withTransactionAsync<T>(action: () => Promise<T>): Promise<T> {
    await this.exec("BEGIN");
    try {
      const result = await action();
      await this.exec("COMMIT");
      return result;
    } catch (error) {
      await this.exec("ROLLBACK");
      throw error;
    }
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

export async function openWritableSeedCopy(): Promise<ExpoSQLiteTestAdapter> {
  const tmpDir = mkdtempSync(path.join(tmpdir(), "jisho-test-"));
  const tmpDb = path.join(tmpDir, "writable.db");
  copyFileSync(DB_PATH, tmpDb);
  return ExpoSQLiteTestAdapter.open(tmpDb, { readonly: false });
}
