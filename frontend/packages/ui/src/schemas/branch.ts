import { z } from "zod";

/**
 * Branch form (admin app), for create and edit. Error messages are i18n keys,
 * rendered by <Field>. Mirrors the backend's CreateOrganizationDto /
 * UpdateOrganizationDto; empty optional fields are "" here and null/omitted in the API.
 */

export const branchSchema = z.object({
  name: z.string().trim().min(1, { error: "validation.required" }).max(50, { error: "validation.nameMax" }),
  description: z.string().trim().max(200, { error: "validation.descriptionMax" }),
  contactEmail: z.union([z.literal(""), z.string().trim().pipe(z.email({ error: "validation.email" }))]),
});
export type BranchValues = z.infer<typeof branchSchema>;
