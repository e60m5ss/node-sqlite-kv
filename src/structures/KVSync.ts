import type { JournalMode, KVSyncOptions } from "@/types";
import { DatabaseSync } from "node:sqlite";
import { serialize, deserialize } from "node:v8";

/**
 * Class representing a synchronous key-value store
 */
export class KVSync<T = any> {
    #db: DatabaseSync;

    /**
     * Create a new key-value store
     * @param path Where the database is stored, or `:memory:` for in-memory storage
     */
    public constructor(options?: KVSyncOptions) {
        this.#db = new DatabaseSync(options?.path ?? ":memory:");

        if (options?.journalMode) {
            const journalModes = [
                "DELETE",
                "MEMORY",
                "OFF",
                "PERSIST",
                "TRUNCATE",
                "WAL",
            ];

            const mode = options?.journalMode.toUpperCase().trim();

            if (!journalModes.includes(mode)) {
                throw new Error(
                    `Invalid KVSync journal mode specified. Received: "${mode}", expected one of: ${journalModes.join(", ")}`
                );
            }

            this.#db.exec(`PRAGMA journal_mode = ${mode}`);
        }

        this.#db.exec(`
            CREATE TABLE IF NOT EXISTS kv (
                key TEXT PRIMARY KEY NOT NULL,
                value BLOB NOT NULL
            ) STRICT
        `);
    }

    /**
     * Sets a key in the database
     * @param key Key name
     * @param value Key value
     * @returns Provided value
     */
    public set<K = T>(key: string, value: K): K {
        this.#db
            .prepare("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)")
            .run(key, serialize(value));

        return value;
    }

    /**
     * Gets a value from the database
     * @param key Key name
     * @returns Value or null
     */
    public get<K = T>(key: string): K | null {
        const row = this.#db.prepare("SELECT value FROM kv WHERE key = ?").get(key);
        return row ? (deserialize(row.value as any) as K) : null;
    }

    /**
     * Deletes a key from the database
     * @param key Key name
     * @returns Deleted key or null
     */
    public delete<K = T>(key: string): K | null {
        const existing = this.get<K>(key);

        if (existing !== null) {
            this.#db.prepare("DELETE FROM kv WHERE key = ?").run(key);
        }

        return existing;
    }

    /**
     * Get all data in the database
     * @returns Array of objects containing keys and values
     */
    public all<K = T>(): { key: string; value: K }[] {
        return this.#db
            .prepare("SELECT key, value FROM kv")
            .all()
            .map((record) => ({
                key: record.key as string,
                value: deserialize(record.value as any) as K,
            }));
    }

    /**
     * Remove all entries from the database
     */
    public clear(): void {
        this.#db.exec("DELETE FROM kv");
    }
}
