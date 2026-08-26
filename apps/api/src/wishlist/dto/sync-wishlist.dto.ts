import { ArrayMaxSize, ArrayUnique, IsArray, IsString, MaxLength } from 'class-validator';

export class SyncWishlistDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  productSlugs!: string[];
}
