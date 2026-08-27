import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CommerceService } from './commerce.service';

@Controller('commerce/webhooks')
export class XPayWebhookController {
  constructor(
    private readonly commerce: CommerceService,
  ) {}

  @Post('xpay')
  @HttpCode(200)
  handleXPayWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('xpay-signature')
    signature: string | undefined,
  ) {
    if (!request.rawBody?.length) {
      throw new BadRequestException(
        'Missing raw XPay webhook body.',
      );
    }

    return this.commerce.handleXPayWebhook(
      request.rawBody,
      signature,
    );
  }
}
