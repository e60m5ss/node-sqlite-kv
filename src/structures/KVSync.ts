import type { JournalMode, KVSyncOptions } from "@/types";
import { DatabaseSync } from "node:sqlite";
import { serialize, deserialize } from "node:v8";
import fs from "node:fs";
import path from "node:path";

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
    public clear(): KVSync {
        this.#db.exec("DELETE FROM kv");
        return this;
    }

    /**
     * Updates the journal mode
     * @param mode New journal mode
     */
    public setJournalMode(mode: JournalMode) {
        const journalModes = [
            "DELETE",
            "MEMORY",
            "OFF",
            "PERSIST",
            "TRUNCATE",
            "WAL",
        ];

        if (!journalModes.includes(mode)) {
            throw new Error(
                `Invalid KVSync journal mode specified. Received: "${mode}", expected one of: ${journalModes.join(", ")}`
            );
        }

        this.#db.exec(`PRAGMA journal_mode = ${mode}`);
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
        this.#db.exec("BEGIN TRANSACTION;");

        const oldMap = new Map<string, T | null | undefined>();
        const newMap = new Map<string, T | null>();
        const tx = Object.create(this);

        tx.set = <K extends T>(key: string, value: K) => {
            if (!oldMap.has(key)) {
                const oldValue = this.get<K>(key);
                oldMap.set(key, oldValue === null ? undefined : oldValue);
            }

            const result = this.set(key, value);
            newMap.set(key, result);
            return result;
        };

        tx.delete = (key: string) => {
            if (!oldMap.has(key)) {
                const oldValue = this.get<T>(key);
                oldMap.set(key, oldValue === null ? undefined : oldValue);
            }

            newMap.set(key, null);
            this.delete(key);
            return oldMap.get(key);
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
