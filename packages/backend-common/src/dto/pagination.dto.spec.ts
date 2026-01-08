import { PaginationDto, createPaginatedResponse } from './pagination.dto';

describe('PaginationDto', () => {
  it('should have default values', () => {
    const dto = new PaginationDto();
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sortOrder).toBe('desc');
  });
});

describe('createPaginatedResponse', () => {
  it('should create correct pagination metadata', () => {
    const items = [1, 2, 3, 4, 5];
    const result = createPaginatedResponse(items, 50, 1, 5);

    expect(result.items).toEqual(items);
    expect(result.meta.total).toBe(50);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(5);
    expect(result.meta.totalPages).toBe(10);
    expect(result.meta.hasNextPage).toBe(true);
    expect(result.meta.hasPreviousPage).toBe(false);
  });

  it('should correctly identify last page', () => {
    const items = [1, 2, 3];
    const result = createPaginatedResponse(items, 23, 5, 5);

    expect(result.meta.page).toBe(5);
    expect(result.meta.totalPages).toBe(5);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(true);
  });

  it('should handle single page', () => {
    const items = [1, 2];
    const result = createPaginatedResponse(items, 2, 1, 10);

    expect(result.meta.totalPages).toBe(1);
    expect(result.meta.hasNextPage).toBe(false);
    expect(result.meta.hasPreviousPage).toBe(false);
  });
});
