import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(
    @Query('category') category?: string,
    @Query('featured') featured?: string,
    @Query('q') q?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.catalog.listProducts({ category, featured, q, sort, page, limit });
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.catalog.getProduct(slug);
  }
}
