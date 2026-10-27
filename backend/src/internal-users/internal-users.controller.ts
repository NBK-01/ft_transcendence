import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { InternalUsersService } from './internal-users.service';
import { InternalUserFactory } from './factories/internal-user.factory';
import { CreateInternalUserDto } from './dto/create-internal-user.dto';
import { UpdateInternalUserDto } from './dto/update-internal-user.dto';
import { RequireRole } from '../common/decorators/access-control.decorator';

/** Every route here is admin-only for now — staff provisioning isn't self-service. */
@ApiTags('Internal Users')
@ApiBearerAuth()
@RequireRole('admin')
@Controller('internal-users')
export class InternalUsersController {
  constructor(private readonly internalUsersService: InternalUsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a staff account' })
  @ApiResponse({ status: 201, description: 'Staff account created' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async create(@Body() dto: CreateInternalUserDto) {
    const user = await this.internalUsersService.create(dto);
    return InternalUserFactory.toDto(user);
  }

  @Get()
  @ApiOperation({ summary: 'List all staff accounts' })
  async findAll() {
    return this.internalUsersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a staff account by id' })
  async findOne(@Param('id') id: string) {
    return this.internalUsersService.getProfile(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a staff account (role, org, active status, name)',
  })
  async update(@Param('id') id: string, @Body() dto: UpdateInternalUserDto) {
    const user = await this.internalUsersService.update(id, dto);
    return InternalUserFactory.toDto(user);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Permanently delete a staff account (not the same as deactivating)',
  })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: 'Would remove the last admin' })
  async remove(@Param('id') id: string) {
    await this.internalUsersService.delete(id);
    return { message: 'Staff account deleted' };
  }
}
