import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminAuthenticatedRequest } from './admin.guard';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AdminAuthenticatedRequest>();
    return request.athrAdmin;
  },
);
