import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequireStaff } from '../common/decorators/access-control.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/context/auth-context.types';
import { MissingRequiredDataException } from '../common/exceptions/validation-exceptions';
import { StaffMeDto } from '../staff-auth/dto/staff-me.dto';
import { StaffProfileDto } from './dto/staff-profile.dto';
import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
import { StaffProfileService } from './staff-profile.service';

/** A staff member's own name and photo, and their colleagues' profile pages. Reading yourself is GET /staff-auth/me. */
@ApiTags('Staff profile')
@ApiBearerAuth()
@RequireStaff()
@Controller('staff-profile')
export class StaffProfileController {
  constructor(private readonly staffProfileService: StaffProfileService) {}

  @Patch()
  @ApiOperation({ summary: 'Change your own name' })
  @ApiResponse({ status: 200, type: StaffMeDto })
  async update(
    @CurrentUser() staff: RequestUser,
    @Body() dto: UpdateStaffProfileDto,
  ) {
    return this.staffProfileService.rename(staff.id, dto.name);
  }

  @Post('avatar')
  @ApiConsumes('multipart/form-data')
  // A hard cap against abuse; the 2 MB rule is FileStorageService's, with its own code (9002).
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiOperation({
    summary: 'Upload your profile photo (JPEG, PNG or WebP, 2 MB)',
  })
  @ApiResponse({ status: 201, description: '{ avatarUrl }' })
  @ApiResponse({
    status: 400,
    description: 'Wrong type (9001) or too large (9002)',
  })
  async uploadAvatar(
    @CurrentUser() staff: RequestUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new MissingRequiredDataException('file');
    }
    return this.staffProfileService.uploadAvatar(staff.id, file);
  }

  @Delete('avatar')
  @ApiOperation({
    summary: 'Remove your profile photo (back to your initials)',
  })
  @ApiResponse({ status: 200, description: '{ avatarUrl: null }' })
  async removeAvatar(@CurrentUser() staff: RequestUser) {
    return this.staffProfileService.removeAvatar(staff.id);
  }

  @Get(':id')
  @ApiOperation({ summary: "A colleague's profile" })
  @ApiResponse({ status: 200, type: StaffProfileDto })
  @ApiResponse({ status: 404, description: 'No such staff member (8001)' })
  async profileOf(
    @CurrentUser() staff: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.staffProfileService.profileOf(staff.id, id);
  }
}
