import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedUser } from '../auth/session.service';
import { AdminGuard } from './admin.guard';
import { AdminService, UploadedDigitalFile, UploadedImageFile } from './admin.service';
import { CurrentAdmin } from './current-admin.decorator';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { UploadProductImageDto } from './dto/product-image.dto';

const imageUploadOptions = {
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
};

const digitalFileUploadOptions = {
  limits: { fileSize: 80 * 1024 * 1024, files: 1 },
};

@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('cloudinary/status')
  cloudinaryStatus() {
    return this.admin.cloudinaryStatus();
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

  @Get('products/:id')
  product(@Param('id') id: string) {
    return this.admin.product(id);
  }

  @Post('products')
  createProduct(
    @Body() dto: CreateProductDto,
    @CurrentAdmin() actor: AuthenticatedUser,
  ) {
    return this.admin.createProduct(dto, actor.id);
  }

  @Patch('products/:id')
  updateProduct(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentAdmin() actor: AuthenticatedUser,
  ) {
    return this.admin.updateProduct(id, dto, actor.id);
  }

  @Delete('products/:id')
  deleteProduct(
    @Param('id') id: string,
    @CurrentAdmin() actor: AuthenticatedUser,
  ) {
    return this.admin.deleteProduct(id, actor.id);
  }

  @Post('products/:id/images/cover')
  @UseInterceptors(FileInterceptor('image', imageUploadOptions))
  uploadProductCover(
    @Param('id') id: string,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Body() dto: UploadProductImageDto,
    @CurrentAdmin() actor: AuthenticatedUser,
  ) {
    return this.admin.uploadProductCover(id, file, dto, actor.id);
  }

  @Post('products/:id/images/gallery')
  @UseInterceptors(FileInterceptor('image', imageUploadOptions))
  uploadProductGalleryImage(
    @Param('id') id: string,
    @UploadedFile() file: UploadedImageFile | undefined,
    @Body() dto: UploadProductImageDto,
    @CurrentAdmin() actor: AuthenticatedUser,
  ) {
    return this.admin.uploadProductGalleryImage(id, file, dto, actor.id);
  }

  @Post('products/:id/digital-file')
  @UseInterceptors(FileInterceptor('file', digitalFileUploadOptions))
  uploadProductDigitalFile(
    @Param('id') id: string,
    @UploadedFile() file: UploadedDigitalFile | undefined,
    @CurrentAdmin() actor: AuthenticatedUser,
  ) {
    return this.admin.uploadProductDigitalFile(id, file, actor.id);
  }

  @Delete('products/:id/digital-file')
  deleteProductDigitalFile(
    @Param('id') id: string,
    @CurrentAdmin() actor: AuthenticatedUser,
  ) {
    return this.admin.deleteProductDigitalFile(id, actor.id);
  }

  @Delete('products/:productId/images/:imageId')
  deleteProductImage(
    @Param('productId') productId: string,
    @Param('imageId') imageId: string,
    @CurrentAdmin() actor: AuthenticatedUser,
  ) {
    return this.admin.deleteProductImage(productId, imageId, actor.id);
  }

  @Get('categories')
  categories() {
    return this.admin.categories();
  }

  @Post('categories')
  createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentAdmin() actor: AuthenticatedUser,
  ) {
    return this.admin.createCategory(dto, actor.id);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentAdmin() actor: AuthenticatedUser,
  ) {
    return this.admin.updateCategory(id, dto, actor.id);
  }

  @Delete('categories/:id')
  deleteCategory(
    @Param('id') id: string,
    @CurrentAdmin() actor: AuthenticatedUser,
  ) {
    return this.admin.deleteCategory(id, actor.id);
  }

  @Get('orders')
  orders() {
    return this.admin.orders();
  }
}
