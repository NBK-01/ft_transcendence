import { z } from "zod";

import { strongPassword } from "@trans/ui/schemas/auth";

/**
 * Staff account forms (admin app). Error messages are i18n keys, rendered by <Field>.
 * Mirrors the backend's CreateInternalUserDto / UpdateInternalUserDto; the
 * password rule is a little stricter than the backend's 8-character minimum.
 */

const name = z.string().trim().min(1, { error: "validation.required" }).max(50, { error: "validation.nameMax" });
const roleName = z.string().min(1, { error: "validation.required" });
/** "" means no branch; the API gets null (edit) or nothing (create). */
const organizationId = z.string();

export const createStaffSchema = z.object({
  name,
  email: z.string().trim().min(1, { error: "validation.required" }).pipe(z.email({ error: "validation.email" })),
  password: strongPassword,
  roleName,
  organizationId,
});
export type CreateStaffValues = z.infer<typeof createStaffSchema>;

/** Email and password can't be changed through PATCH /internal-users/:id. */
export const editStaffSchema = z.object({ name, roleName, organizationId });
export type EditStaffValues = z.infer<typeof editStaffSchema>;
