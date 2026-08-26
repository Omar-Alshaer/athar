import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';
import { NewsletterRateLimitService } from './newsletter-rate-limit.service';
import { NewsletterService } from './newsletter.service';

@Controller('newsletter')
export class NewsletterController {
  constructor(
    private readonly newsletter: NewsletterService,
    private readonly rateLimit: NewsletterRateLimitService,
  ) {}

  @Post('subscribe')
  subscribe(@Body() dto: SubscribeNewsletterDto, @Req() request: Request) {
    const email = dto.email.trim().toLowerCase();
    const client = request.ip || request.socket.remoteAddress || 'unknown';
    this.rateLimit.assertAllowed(`${client}:${email}`);
    return this.newsletter.subscribe(email);
  }
}
