import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequireRole } from '../common/decorators/access-control.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/context/auth-context.types';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ListApiKeysQueryDto } from './dto/list-api-keys-query.dto';
import { ApiKeyDto, CreatedApiKeyDto } from './dto/api-key.dto';

/**
 * Admin-only: the keys partner systems use to call the public API. These
 * routes take the admin's login token like any other staff route; the keys
 * they manage are a separate credential, for the public API only.
 */
@ApiTags('API keys')
@ApiBearerAuth()
@RequireRole('admin')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  // The body holds the full key: no cache may keep a copy.
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary:
      'Create an API key for a branch. The full key is in this response only',
  })
  @ApiResponse({ status: 201, type: CreatedApiKeyDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid body, or the branch is inactive',
  })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async create(
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.apiKeysService.create(dto, currentUser.id);
  }

  @Get()
  @ApiOperation({
    summary: 'List API keys, masked, newest first (revoked ones included)',
  })
  @ApiResponse({ status: 200, type: [ApiKeyDto] })
  async list(@Query() query: ListApiKeysQueryDto) {
    return this.apiKeysService.list(query);
  }

  @Delete(':id')
  @ApiOperation({
    summary:
      'Revoke an API key: it stops working at once. Revoking it again changes nothing',
  })
  @ApiResponse({
    status: 200,
    type: ApiKeyDto,
    description: 'The key, with revokedAt set',
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.apiKeysService.revoke(id);
  }
}
