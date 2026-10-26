import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** "YYYY-MM-DD": a real calendar date, after 1900, not in the future. Mirrors frontend/packages/ui/src/schemas/profile.ts#isValidBirthDate. */
@ValidatorConstraint({ name: 'isValidBirthDate', async: false })
class IsValidBirthDateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
      return false;
    }
    const [year, month, day] = [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
    ];
    const date = new Date(year, month - 1, day);
    const isRealDate =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
    return isRealDate && year >= 1900 && date <= new Date();
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a real calendar date (YYYY-MM-DD), after 1900 and not in the future`;
  }
}

/** Leading "+", then 7-15 digits (the E.164 maximum) ignoring separators. Mirrors frontend/packages/ui/src/schemas/profile.ts#isValidPhone. */
@ValidatorConstraint({ name: 'isValidPhone', async: false })
class IsValidPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') {
      return false;
    }
    const digits = value.replace(/\D/g, '');
    return (
      /^\+[\d\s().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15
    );
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be an international number starting with "+" and 7 to 15 digits`;
  }
}

/** PATCH /users/profile body. Email isn't editable here. */
export class UpdateProfileDto {
  @ApiProperty({ example: 'Amina' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  firstName!: string;

  @ApiProperty({ example: 'El Idrissi' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  lastName!: string;

  @ApiProperty({
    example: '1998-04-12',
    nullable: true,
    description: 'Calendar date, "YYYY-MM-DD" (no time, no time zone).',
  })
  @IsOptional()
  @Validate(IsValidBirthDateConstraint)
  dateOfBirth?: string | null;

  @ApiProperty({
    example: '+961 70 123 456',
    nullable: true,
    description: 'International format.',
  })
  @IsOptional()
  @Transform(trim)
  @Validate(IsValidPhoneConstraint)
  phoneNumber?: string | null;
}
