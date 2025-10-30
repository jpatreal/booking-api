export const whereBiz = (
  businessId: string,
  extra: Record<string, any> = {},
  includeDeleted = false,
) => ({
  where: {
    businessId,
    ...(includeDeleted ? {} : { deletedAt: null }),
    ...extra,
  },
});
