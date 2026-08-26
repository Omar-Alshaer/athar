import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list() {
    return this.catalog.listCategories();
  }
}
