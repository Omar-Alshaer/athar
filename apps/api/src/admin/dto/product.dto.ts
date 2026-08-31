import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  Equals,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ProductStatus } from '../../generated/prisma/client';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateProductDto {
  @IsString()
  @Length(2, 100)
  @Matches(slugPattern)
  slug!: string;

  @IsString()
  @Length(2, 180)
  titleAr!: string;

  @IsString()
  @Length(2, 220)
  subtitleAr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descriptionAr?: string;

  @IsUUID()
  categoryId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  price!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  compareAtPrice?: number | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  sarPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  sarCompareAtPrice?: number | null;

  @IsOptional()
  @IsString()
  @Equals('EGP')
  currency?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  badgeAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  formatLabelAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contentLabelAr?: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  @Matches(slugPattern)
  slug?: string;

  @IsOptional()
  @IsString()
  @Length(2, 180)
  titleAr?: string;

  @IsOptional()
  @IsString()
  @Length(2, 220)
  subtitleAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descriptionAr?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  compareAtPrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  sarPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  sarCompareAtPrice?: number | null;

  @IsOptional()
  @IsString()
  @Equals('EGP')
  currency?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  badgeAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  formatLabelAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contentLabelAr?: string;
}
