import { z } from "zod";

/**
 * New API key form (admin app). Error messages are i18n keys, rendered by
 * <Field>. Mirrors the backend's CreateApiKeyDto (name trimmed, 1–100
 * characters; organizationId a branch's uuid).
 */

export const apiKeySchema = z.object({
  name: z.string().trim().min(1, { error: "validation.required" }).max(100, { error: "validation.max100" }),
  organizationId: z.string().min(1, { error: "validation.required" }),
});
export type ApiKeyValues = z.infer<typeof apiKeySchema>;
