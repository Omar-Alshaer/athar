import { Module } from '@nestjs/common';
import { NewsletterController } from './newsletter.controller';
import { NewsletterRateLimitService } from './newsletter-rate-limit.service';
import { NewsletterService } from './newsletter.service';

@Module({
  controllers: [NewsletterController],
  providers: [NewsletterService, NewsletterRateLimitService],
})
export class NewsletterModule {}
