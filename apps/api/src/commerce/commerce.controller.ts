import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import { AuthenticatedUser } from '../auth/session.service';
import { CommerceService } from './commerce.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@UseGuards(SessionGuard)
@Controller('commerce')
export class CommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Post('checkout/session')
  createCheckoutSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    return this.commerce.createCheckoutSession(user, dto);
  }

  @Get('orders')
  orders(@CurrentUser() user: AuthenticatedUser) {
    return this.commerce.myOrders(user.id);
  }

  @Get('orders/:orderNumber')
  order(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderNumber') orderNumber: string,
  ) {
    return this.commerce.order(user.id, orderNumber);
  }

  @Get('library')
  library(@CurrentUser() user: AuthenticatedUser) {
    return this.commerce.library(user.id);
  }

  @Get('library/:libraryItemId/download')
  async downloadLibraryItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('libraryItemId') libraryItemId: string,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.commerce.prepareLibraryDownload(user.id, libraryItemId);
    const safeAsciiName = file.fileName
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\]/g, '_')
      .slice(0, 140) || 'athr-book';

    response.status(200);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', String(file.size));
    response.setHeader('Cache-Control', 'private, no-store, max-age=0');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );

    const stream = createReadStream(file.absolutePath);
    stream.on('error', () => response.destroy());
    stream.pipe(response);
  }

  @Post('payments/mock/:orderNumber/succeed')
  completeMockPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderNumber') orderNumber: string,
  ) {
    return this.commerce.completeMockPayment(user.id, orderNumber);
  }
}
