"use strict";
/* ------------------------------------------------------------------ */
/*  Shared types between main (Electron) and renderer (React)        */
/* ------------------------------------------------------------------ */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpcChannels = void 0;
// ---- IPC channel names ----
exports.IpcChannels = {
    CONNECT: "sql:connect",
    DISCONNECT: "sql:disconnect",
    GET_DATABASES: "sql:get-databases",
    GET_DATABASE_CHILDREN: "sql:get-database-children",
    GET_TABLE_INDEXES: "sql:get-table-indexes",
    GET_TABLE_COLUMNS: "sql:get-table-columns",
    GET_DISK_SPACE: "sql:get-disk-space",
    GET_INDEX_SPACE: "sql:get-index-space",
    EXECUTE_QUERY: "sql:execute-query",
    SHRINK: "sql:shrink",
};
