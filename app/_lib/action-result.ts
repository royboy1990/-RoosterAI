/** Shared result shape for server actions — safe to type-import from Client Components. */
export type ActionResult =
  | { ok: true; message: string; briefId?: string }
  | { ok: false; message: string; error: string };
