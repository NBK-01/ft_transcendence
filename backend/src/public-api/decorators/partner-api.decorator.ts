import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { API_KEY_SECURITY } from '../constants/api-key.constants';

/**
 * A public API route: an API key instead of a login token. @Public() makes
 * the global JwtAuthGuard skip it (in this project it means only "no login
 * token"), AccessControlGuard lets a route with no access-control metadata
 * through, and ApiKeyGuard does the checking.
 */
export const PartnerApi = () =>
  applyDecorators(
    Public(),
    UseGuards(ApiKeyGuard),
    ApiSecurity(API_KEY_SECURITY),
    ApiHeader({
      name: 'X-Internal-Key',
      required: false,
      description:
        'Only for our own services, on top of a valid X-API-Key: lifts the per-key rate limit',
    }),
    ApiResponse({
      status: 401,
      description:
        'X-API-Key missing (16003), invalid (16004) or revoked (16005)',
    }),
    ApiResponse({
      status: 403,
      description: "The key's branch is deactivated (16006)",
    }),
    ApiResponse({
      status: 429,
      description:
        'Over the per-key rate limit (16007): see the Retry-After and X-RateLimit-* headers',
    }),
  );
