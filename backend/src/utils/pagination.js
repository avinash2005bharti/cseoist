export const parsePagination = (query = {}) => {
  const isAll = query && (query.all === 'true' || query.all === true);
  const page = isAll ? 1 : Math.max(1, parseInt(query?.page, 10) || 1);
  const limit = isAll ? 1000 : Math.min(100, Math.max(1, parseInt(query?.limit, 10) || 20));
  const skip = isAll ? 0 : (page - 1) * limit;

  return { page, limit, skip, isAll };
};

export const buildPaginationMeta = (total, page, limit) => {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

export default {
  parsePagination,
  buildPaginationMeta,
};
