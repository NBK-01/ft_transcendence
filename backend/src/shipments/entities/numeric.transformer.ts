import { ValueTransformer } from 'typeorm';

/** pg returns NUMERIC columns as strings (to avoid precision loss) — amounts here fit a JS number. */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
