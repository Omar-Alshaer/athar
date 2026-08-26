import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CatalogService } from './catalog.service';
import { ProductsController } from './products.controller';

@Module({
  controllers: [CategoriesController, ProductsController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
