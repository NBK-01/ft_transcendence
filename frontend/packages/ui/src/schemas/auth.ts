import { z } from "zod";

/**
 * Frontend validation for auth forms. Error messages are i18n keys
 * (rendered by <Field>), so they translate with the UI.
 * The backend validates the same rules independently — never trust the client.
 */

const email = z.string().trim().min(1, { error: "validation.required" }).pipe(z.email({ error: "validation.email" }));

const name = z
  .string()
  .trim()
  .min(1, { error: "validation.required" })
  .max(50, { error: "validation.nameMax" });

export const strongPassword = z
  .string()
  .min(8, { error: "validation.passwordMin" })
  .regex(/[A-Za-z]/, { error: "validation.passwordStrength" })
  .regex(/\d/, { error: "validation.passwordStrength" });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "validation.required" }),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    firstName: name,
    lastName: name,
    email,
    password: strongPassword,
    confirmPassword: z.string().min(1, { error: "validation.required" }),
    acceptTerms: z.boolean().refine((value) => value, { error: "validation.terms" }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    error: "validation.passwordMatch",
    path: ["confirmPassword"],
  });
export type SignUpValues = z.infer<typeof signUpSchema>;

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, { error: "validation.otp" }),
});
export type OtpValues = z.infer<typeof otpSchema>;
