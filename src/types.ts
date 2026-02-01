/**
 * SQLite journal mode
 * @default DELETE
 */
export type JournalMode =
    | "DELETE"
    | "MEMORY"
    | "OFF"
    | "PERSIST"
    | "TRUNCATE"
    | "WAL";

/**
 * Configuration options for instantiating a KVSync
 */
export interface KVSyncOptions {
    path?: SQLitePath;
    journalMode?: JournalMode;
}

/**
 * File path or :memory: (for SQLite use)
 */
export type SQLitePath = ":memory:" | (string & {});
