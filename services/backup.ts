import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as SQLite from "expo-sqlite";

/**
 * Utility class for handling SQLite database backups to iCloud
 */
export class SQLiteBackupManager {
  private dbName: string;
  // Fix database type to match what expo-sqlite returns
  private dbDirectory: string;
  private backupDirectory: string;

  /**
   * Creates a new backup manager for a specific database
   * @param {string} dbName - The name of the SQLite database to backup
   */
  constructor(dbName: string) {
    this.dbName = dbName;
    // Don't open database in constructor - we'll open it when needed
    this.dbDirectory = FileSystem.documentDirectory + "SQLite/";
    this.backupDirectory = FileSystem.documentDirectory + "backups/";
  }

  /**
   * Initialize backup directories
   */
  async init(): Promise<void> {
    // Create backup directory if it doesn't exist
    const backupDirInfo = await FileSystem.getInfoAsync(this.backupDirectory);
    if (!backupDirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.backupDirectory, {
        intermediates: true,
      });
    }
  }

  /**
   * Open the database connection
   * @returns {Promise<SQLite.SQLiteDatabase>} The database connection
   */
  private async openDatabase(): Promise<SQLite.SQLiteDatabase> {
    return await SQLite.openDatabaseAsync(this.dbName);
  }

  /**
   * Safely close the database connection
   * @param {SQLite.SQLiteDatabase} db - The database connection to close
   */
  private async closeDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
    return await new Promise<void>((resolve) => {
      if (db.closeAsync) {
        db.closeAsync().then(resolve).catch(resolve);
      } else {
        // Fallback for versions that don't have closeAsync
        resolve();
      }
    });
  }

  /**
   * Execute an operation that requires database access
   * @param {function} operation - The operation to perform with the database
   * @returns {Promise<T>} The result of the operation
   */
  private async withDatabase<T>(
    operation: (db: SQLite.SQLiteDatabase) => Promise<T>
  ): Promise<T> {
    const db = await this.openDatabase();
    try {
      return await operation(db);
    } finally {
      await this.closeDatabase(db);
    }
  }

  /**
   * Create a backup of the database
   * @returns {Promise<string>} Path to the created backup file
   */
  async createBackup(): Promise<string> {
    await this.init();

    // Use withDatabase helper to manage db connection
    await this.withDatabase(async () => {
      // Database will be automatically closed after this operation
    });

    const dbPath = `${this.dbDirectory}${this.dbName}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFileName = `${this.dbName}-backup-${timestamp}.db`;
    const backupPath = `${this.backupDirectory}${backupFileName}`;

    // Copy the database file to create a backup
    await FileSystem.copyAsync({
      from: dbPath,
      to: backupPath,
    });

    return backupPath;
  }

  /**
   * Share the backup file to iCloud or other services
   * @param {string} backupPath - Path to the backup file
   */
  async shareBackup(backupPath: string): Promise<void> {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(backupPath, {
        mimeType: "application/octet-stream",
        dialogTitle: "Share Database Backup",
        UTI: "public.database", // Used for iOS
      });
    } else {
      throw new Error("Sharing is not available on this device");
    }
  }

  /**
   * For iOS: Share backup directly to iCloud Drive
   * This uses the standard sharing mechanism which includes iCloud
   * @returns {Promise<string>} Path to the shared backup file
   */
  async backupToICloud(): Promise<string> {
    const backupPath = await this.createBackup();
    await this.shareBackup(backupPath);
    return backupPath;
  }

  /**
   * Restore database from a backup file
   * @returns {Promise<boolean>} Success status
   */
  async restoreFromBackup(): Promise<boolean> {
    try {
      // Let user pick the backup file
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/octet-stream",
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return false;
      }

      const backupUri = result.assets[0].uri;
      const dbPath = `${this.dbDirectory}${this.dbName}`;

      // Close any existing database connection before replacing the file
      await this.withDatabase(async () => {
        // This will ensure the database is closed before restoration
      });

      // Copy the backup file to the database location
      await FileSystem.copyAsync({
        from: backupUri,
        to: dbPath,
      });

      return true;
    } catch (error) {
      console.error("Error restoring database:", error);
      throw error;
    }
  }

  /**
   * Get list of local backups
   * @returns {Promise<Array<string>>} Array of backup file paths
   */
  async getBackupsList(): Promise<Array<string>> {
    await this.init();
    const backupFiles = await FileSystem.readDirectoryAsync(
      this.backupDirectory
    );
    return backupFiles
      .filter((file) => file.startsWith(this.dbName))
      .map((file) => `${this.backupDirectory}${file}`);
  }

  /**
   * Delete a backup file
   * @param {string} backupPath - Path to the backup file to delete
   */
  async deleteBackup(backupPath: string): Promise<void> {
    await FileSystem.deleteAsync(backupPath);
  }
}
