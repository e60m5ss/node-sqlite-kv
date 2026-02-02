import { DatabaseSync } from "node:sqlite";
import { serialize, deserialize } from "node:v8";
import fs from "node:fs";
import path from "node:path";

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

/**
 * A list of journal modes SQLite supports
 */
export const journalModes: JournalMode[] = [
    "DELETE",
    "MEMORY",
    "OFF",
    "PERSIST",
    "TRUNCATE",
    "WAL",
];

/**
 * Class representing a synchronous key-value store
 */
export class KVSync<T = any> {
    #db: DatabaseSync;

    /**
     * Instantiate a new key-value store
     * @param path Where the database is stored, or `:memory:` for in-memory storage
     */
    public constructor(options?: KVSyncOptions) {
        const dbPath = options?.path ?? ":memory:";

        if (dbPath !== ":memory:") {
            fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        }

        this.#db = new DatabaseSync(dbPath);
        this.setJournalMode(options?.journalMode ?? "DELETE");
        this.#db.exec(`
            CREATE TABLE IF NOT EXISTS kv (
                key TEXT PRIMARY KEY NOT NULL,
                value BLOB NOT NULL
            ) STRICT;
        `);
    }

    /**
     * Set a key in the database
     * @param key Key name
     * @param value Key value
     * @returns Provided value
     */
    public set<K = T>(key: string, value: K | undefined): K {
        if (!key || typeof key !== "string") {
            throw new Error(
                "[KVSync]: Key must be provided and be a non-empty string."
            );
        }

        if (value === undefined) {
            throw new Error(
                "[KVSync]: Provided value is undefined. Did you mean to use delete() instead?"
            );
        }

        this.#db
            .prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)")
            .run(key, serialize(value));

        return value;
    }

    /**
     * Get a value from the database
     * @param key Key name
     * @returns Value or null
     */
    public get<K = T>(key: string): K | null {
        if (!key || typeof key !== "string") {
            throw new Error(
                "[KVSync]: Key must be provided and be a non-empty string."
            );
        }

        const row = this.#db.prepare("SELECT value FROM kv WHERE key = ?").get(key);
        return row ? (deserialize(row.value as any) as K) : null;
    }

    /**
     * Delete a key from the database
     * @param key Key name
     * @returns KVSync instance
     */
    public delete(key: string): KVSync {
        if (!key || typeof key !== "string") {
            throw new Error(
                "[KVSync]: Key must be provided and be a non-empty string."
            );
        }

        this.#db.prepare("DELETE FROM kv WHERE key = ?").run(key);
        return this;
    }

    /**
     * Get all data in the database
     * @returns Array of objects containing keys and values
     */
    public all<K = T>(
        filter?: (key: string, value: K) => boolean
    ): { key: string; value: K }[] {
        const rows = this.#db.prepare("SELECT key, value FROM kv").iterate();
        const result: { key: string; value: K }[] = [];

        for (const row of rows as any) {
            const key = row.key as string;
            const value = deserialize(row.value as any) as K;

            if (!filter || filter(key, value)) {
                result.push({ key, value });
            }
        }

        return result;
    }

    /**
     * Remove all entries from the database
     */
    public clear(): KVSync {
        this.#db.exec("DELETE FROM kv;");
        return this;
    }

    /**
     * Update the journal mode
     * @param mode New journal mode
     */
    public setJournalMode(mode: JournalMode) {
        if (!journalModes.includes(mode)) {
            throw new Error(
                `[KVSync]: Invalid journal mode specified. Received: "${mode}", expected one of: ${journalModes.join(", ")}`
            );
        }

        this.#db.exec(`PRAGMA journal_mode = ${mode};`);
        return this;
    }

    /**
     * Perform a transaction
     * @param callback Callback with KVSync instance
     * @returns Object containing oldValues and newValues each containing arrays of keys and values
     */
    public transaction<R>(callback: (kv: KVSync<T>) => R): {
        oldValues: { key: string; value: T | null | undefined }[];
        newValues: { key: string; value: T | null }[];
    } {
        if (!callback) {
            throw new Error(
                "[KVSync]: A callback must be provided when using transaction()."
            );
        }

        if (typeof callback !== "function") {
            throw new Error(
                `[KVSync]: Transaction callback must be of type function. Received: ${typeof callback}`
            );
        }

        this.#db.exec("BEGIN TRANSACTION;");

        const oldMap = new Map<string, T | null | undefined>();
        const newMap = new Map<string, T | null>();
        const tx = Object.create(this);

        tx.set = <K extends T>(key: string, value: K | undefined): K | null => {
            if (!oldMap.has(key)) {
                const oldValue = this.get<K>(key);
                oldMap.set(key, oldValue === null ? undefined : oldValue);
            }

            const result = this.set(key, value);
            newMap.set(key, result);
            return result;
        };

        tx.delete = (key: string): KVSync => {
            if (!oldMap.has(key)) {
                const oldValue = this.get<T>(key);
                oldMap.set(key, oldValue === null ? undefined : oldValue);
            }

            newMap.set(key, null);
            this.delete(key);
            return tx;
        };

        try {
            callback(tx);
            this.#db.exec("COMMIT;");
        } catch (error: any) {
            this.#db.exec("ROLLBACK;");
            throw error;
        }

        return {
            oldValues: Array.from(oldMap.entries()).map(([key, value]) => ({
                key,
                value,
            })),

            newValues: Array.from(newMap.entries()).map(([key, value]) => ({
                key,
                value,
            })),
        };
    }
}
