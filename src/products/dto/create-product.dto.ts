import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min, IsUrl } from 'class-validator';

export class CreateProductDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name!: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsNumber()
    @Min(0)
    price_sale!: number;

    @IsNumber()
    @Min(0)
    cost!: number;

    @IsInt()
    @Min(0)
    quantity!: number;

    // Support both base64 (legacy) and URL (new Supabase Storage)
    @IsString()
    @IsOptional()
    imageBase64?: string;

    @IsString()
    @IsOptional()
    @IsUrl()
    imageUrl?: string;
}


