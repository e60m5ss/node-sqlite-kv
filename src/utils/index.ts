/**
 * A list of journal modes SQLite supports
 */
export const journalModes = [
    "DELETE",
    "MEMORY",
    "OFF",
    "PERSIST",
    "TRUNCATE",
    "WAL",
] as const;
