import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('users')
  users() {
    return this.admin.users();
  }

  @Get('newsletter')
  newsletter() {
    return this.admin.newsletter();
  }

  @Get('products')
  products() {
    return this.admin.products();
  }

  @Get('categories')
  categories() {
    return this.admin.categories();
  }

  @Get('orders')
  orders() {
    return this.admin.orders();
  }
}
