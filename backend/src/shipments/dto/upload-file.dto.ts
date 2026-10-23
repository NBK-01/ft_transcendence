import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  ATTACHMENT_KINDS,
  type AttachmentKind,
} from '../constants/shipment-state';

/** Multipart body of POST /admin/shipments/:trackingId/files, with the file in `file`. */
export class UploadFileDto {
  @ApiProperty({ enum: ATTACHMENT_KINDS })
  @IsIn(ATTACHMENT_KINDS)
  kind!: AttachmentKind;

  /**
   * Files arrive through multer, not here. This only tolerates the blank
   * text part Swagger UI (and some form libraries) send for an empty file
   * slot, which the global forbidNonWhitelisted would otherwise reject.
   */
  @ApiHideProperty()
  @IsOptional()
  file?: unknown;
}
