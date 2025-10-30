import { SetMetadata } from '@nestjs/common';

export const RES_MSG_KEY = 'res:message';
export const RES_PAGINATED_KEY = 'res:paginated';
export const RES_BYPASS_KEY = 'res:bypass';

export const ResMessage = (message: string) =>
  SetMetadata(RES_MSG_KEY, message);
export const ResPaginated = () => SetMetadata(RES_PAGINATED_KEY, true);
export const ResBypass = () => SetMetadata(RES_BYPASS_KEY, true);
