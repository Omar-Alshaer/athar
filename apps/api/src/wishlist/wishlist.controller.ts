import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard } from '../auth/session.guard';
import type { AuthenticatedUser } from '../auth/session.service';
import { SyncWishlistDto } from './dto/sync-wishlist.dto';
import { WishlistService } from './wishlist.service';

@UseGuards(SessionGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.wishlist.list(user.id);
  }

  @Post('sync')
  sync(@CurrentUser() user: AuthenticatedUser, @Body() dto: SyncWishlistDto) {
    return this.wishlist.sync(user.id, dto.productSlugs);
  }

  @Post(':slug')
  add(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    return this.wishlist.add(user.id, slug);
  }

  @Delete(':slug')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('slug') slug: string) {
    return this.wishlist.remove(user.id, slug);
  }
}
