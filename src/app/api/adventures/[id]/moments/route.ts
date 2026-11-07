/**
 * **Share a memory with the people on an adventure** (ADR 014).
 *
 * The core's shared-moments handlers, reached at the core's own address
 * rather than Christmas's. ADR 014 named this move ("the store belongs beside
 * `store.ts`, with the routes under `/api/adventures/[id]/…`"); re-exporting
 * keeps one implementation and one set of rules: members read, you share in
 * your own name, and until the migration is applied it answers 409 `off`.
 */
export { GET, POST } from "@/app/christmas/api/[id]/moments/route";
