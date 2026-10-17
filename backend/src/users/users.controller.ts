import {
  Controller,
  Get,
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
import { FileStorageService } from '../file-storage/file-storage.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/context/auth-context.types';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
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
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: RequestUser,
  ) {
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

  @Get()
  @ApiOperation({ summary: 'List all users' })
  @ApiResponse({
    status: 200,
    description: 'List of users retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll() {
    return this.usersService.findAll();
  }
}
