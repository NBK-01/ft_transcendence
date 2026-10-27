import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { OrganizationFactory } from './factories/organization.factory';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import {
  RequirePermission,
  RequireStaff,
} from '../common/decorators/access-control.decorator';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @RequirePermission('organizations:manage')
  @Post()
  @ApiOperation({ summary: 'Create an organization (branch)' })
  @ApiResponse({ status: 201, description: 'Organization created' })
  async create(@Body() dto: CreateOrganizationDto) {
    const org = await this.organizationsService.create(dto);
    return OrganizationFactory.toDto(org);
  }

  @RequireStaff()
  @Get()
  @ApiOperation({ summary: 'List organizations' })
  async findAll() {
    return this.organizationsService.findAll();
  }

  @RequireStaff()
  @Get(':id')
  @ApiOperation({ summary: 'Get an organization by id' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.getById(id);
  }

  @RequirePermission('organizations:manage')
  @Patch(':id')
  @ApiOperation({ summary: 'Update an organization' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    const org = await this.organizationsService.update(id, dto);
    return OrganizationFactory.toDto(org);
  }

  @RequirePermission('organizations:manage')
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete an organization',
    description:
      'Only one with no staff, shipments or API keys (409, 4003). To keep its history, deactivate it instead: PATCH isActive false.',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.organizationsService.remove(id);
    return { message: 'Organization deleted' };
  }

  @RequirePermission('organizations:manage')
  @Post(':id/staff/:internalUserId')
  @ApiOperation({ summary: 'Assign a staff member to this organization' })
  async assignStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('internalUserId', ParseUUIDPipe) internalUserId: string,
  ) {
    await this.organizationsService.assignStaff(id, internalUserId);
    return { message: 'Staff member assigned' };
  }

  @RequirePermission('organizations:manage')
  @Delete(':id/staff/:internalUserId')
  @ApiOperation({ summary: 'Remove a staff member from this organization' })
  async removeStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('internalUserId', ParseUUIDPipe) internalUserId: string,
  ) {
    await this.organizationsService.removeStaff(id, internalUserId);
    return { message: 'Staff member removed' };
  }

  @RequireStaff()
  @Get(':id/staff')
  @ApiOperation({ summary: "List an organization's staff" })
  async listStaff(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.listStaff(id);
  }
}
