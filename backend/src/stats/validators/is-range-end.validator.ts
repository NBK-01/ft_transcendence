import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The end of a period: after the property named `startProperty`, and at most
 * `maxDays` later. Dates that don't parse pass here: IsISO8601 reports them.
 */
export function IsRangeEnd(
  startProperty: string,
  maxDays: number,
  options?: ValidationOptions,
) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isRangeEnd',
      target: object.constructor,
      propertyName,
      constraints: [startProperty, maxDays],
      options: {
        message: `${propertyName} must be after ${startProperty}, at most ${maxDays} days later`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [start, max] = args.constraints as [string, number];
          const from = Date.parse(
            String((args.object as Record<string, unknown>)[start]),
          );
          const to = Date.parse(String(value));
          if (Number.isNaN(from) || Number.isNaN(to)) {
            return true;
          }
          return to > from && to - from <= max * DAY_MS;
        },
      },
    });
}
