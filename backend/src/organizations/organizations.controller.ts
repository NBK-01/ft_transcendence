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
  async findOne(@Param('id') id: string) {
    return this.organizationsService.getById(id);
  }

  @RequirePermission('organizations:manage')
  @Patch(':id')
  @ApiOperation({ summary: 'Update an organization' })
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto) {
    const org = await this.organizationsService.update(id, dto);
    return OrganizationFactory.toDto(org);
  }

  @RequirePermission('organizations:manage')
  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate an organization' })
  async deactivate(@Param('id') id: string) {
    await this.organizationsService.deactivate(id);
    return { message: 'Organization deactivated' };
  }

  @RequirePermission('organizations:manage')
  @Post(':id/staff/:internalUserId')
  @ApiOperation({ summary: 'Assign a staff member to this organization' })
  async assignStaff(
    @Param('id') id: string,
    @Param('internalUserId') internalUserId: string,
  ) {
    await this.organizationsService.assignStaff(id, internalUserId);
    return { message: 'Staff member assigned' };
  }

  @RequirePermission('organizations:manage')
  @Delete(':id/staff/:internalUserId')
  @ApiOperation({ summary: 'Remove a staff member from this organization' })
  async removeStaff(@Param('internalUserId') internalUserId: string) {
    await this.organizationsService.removeStaff(internalUserId);
    return { message: 'Staff member removed' };
  }

  @RequireStaff()
  @Get(':id/staff')
  @ApiOperation({ summary: "List an organization's staff" })
  async listStaff(@Param('id') id: string) {
    return this.organizationsService.listStaff(id);
  }
}
