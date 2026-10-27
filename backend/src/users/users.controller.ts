import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { FileStorageService } from '../file-storage/file-storage.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  RequireCustomer,
  RequireRole,
} from '../common/decorators/access-control.decorator';
import { RequestUser } from '../common/context/auth-context.types';
import { MissingRequiredDataException } from '../common/exceptions/validation-exceptions';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() currentUser: RequestUser) {
    return this.usersService.getProfile(currentUser.id);
  }

  @RequireCustomer()
  @Patch('profile')
  @ApiOperation({ summary: "Update the current user's profile" })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.usersService.updateProfile(currentUser.id, dto);
  }

  @RequireCustomer()
  @Post('profile/avatar')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    // Generous hard cap against abuse/memory exhaustion — the real 2MB business
    // limit is FileStorageService's own check, which throws a typed
    // FileTooLargeException (errorCode 9002) instead of multer's untyped 413.
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: "Upload the current user's avatar" })
  @ApiResponse({ status: 201, description: 'Avatar uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file type or too large' })
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() currentUser: RequestUser,
  ) {
    if (!file) {
      throw new MissingRequiredDataException('file');
    }
    const { url, key } = await this.fileStorageService.uploadAvatar(
      file.buffer,
      currentUser.id,
      file.originalname,
      file.mimetype,
    );
    const { previousKey } = await this.usersService.updateAvatar(
      currentUser.id,
      { key },
    );
    if (previousKey) {
      await this.fileStorageService.deleteFile(previousKey);
    }
    return { avatarUrl: url };
  }

  @RequireCustomer()
  @Delete('profile/avatar')
  @ApiOperation({ summary: "Remove the current user's avatar" })
  @ApiResponse({ status: 200, description: 'Avatar removed' })
  async deleteAvatar(@CurrentUser() currentUser: RequestUser) {
    const { previousKey } = await this.usersService.removeAvatar(
      currentUser.id,
    );
    if (previousKey) {
      await this.fileStorageService.deleteFile(previousKey).catch((error) => {
        this.logger.warn(
          `Could not delete storage object ${previousKey}: ${String(error)}`,
        );
      });
    }
    return { message: 'Avatar removed' };
  }

  /** Every customer's email and name — admins only, like GET /internal-users. */
  @Get()
  @RequireRole('admin')
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of users retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Not an admin' })
  async findAll() {
    return this.usersService.findAll();
  }
}
