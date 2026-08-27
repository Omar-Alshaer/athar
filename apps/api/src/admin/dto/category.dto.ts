import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCategoryDto {
  @IsString()
  @Length(2, 80)
  nameAr!: string;

  @IsString()
  @Length(2, 80)
  @Matches(slugPattern)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shortAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  @Matches(slugPattern)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shortAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  tone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}
