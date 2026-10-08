export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

/**
 * Returned by list endpoints. ResponseInterceptor unwraps this into
 * { success, statusCode, data: items, meta } instead of nesting it under
 * `data` as-is — see common/interceptors/response.interceptor.ts.
 */
export class PaginatedResponseDto<T> {
  items: T[];
  meta: PaginationMeta;

  private constructor(items: T[], meta: PaginationMeta) {
    this.items = items;
    this.meta = meta;
  }

  static create<T>(
    items: T[],
    totalItems: number,
    page: number,
    limit: number,
  ): PaginatedResponseDto<T> {
    return new PaginatedResponseDto(items, {
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
    });
  }
}
