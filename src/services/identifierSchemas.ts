import { z } from "zod";

// These existing client workflows recognize UUID versions 1–5 as saved records.
// Keep that restriction while delegating UUID syntax to Zod.
export const savedAccountIdSchema = z.uuid().refine(
  (id) => ["1", "2", "3", "4", "5"].includes(id[14]),
);
