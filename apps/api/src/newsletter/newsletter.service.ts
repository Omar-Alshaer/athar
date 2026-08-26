import { Injectable } from '@nestjs/common';
import { NewsletterStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(rawEmail: string) {
    const email = this.normalizeEmail(rawEmail);
    const existing = await this.prisma.newsletterSubscription.findUnique({
      where: { email },
      select: { status: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    const now = new Date();
    const subscription = await this.prisma.newsletterSubscription.upsert({
      where: { email },
      update: {
        status: NewsletterStatus.SUBSCRIBED,
        source: 'footer',
        subscribedAt: existing?.status === NewsletterStatus.SUBSCRIBED ? undefined : now,
        unsubscribedAt: null,
        ...(user ? { userId: user.id } : {}),
      },
      create: {
        email,
        userId: user?.id ?? null,
        status: NewsletterStatus.SUBSCRIBED,
        source: 'footer',
        subscribedAt: now,
      },
      select: {
        email: true,
        status: true,
        subscribedAt: true,
      },
    });

    return {
      ok: true,
      alreadySubscribed: existing?.status === NewsletterStatus.SUBSCRIBED,
      subscription,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
