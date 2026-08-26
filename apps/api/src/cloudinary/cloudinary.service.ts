import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from 'cloudinary';

export type AthrImageUpload = {
  buffer: Buffer;
  folder: string;
  publicId?: string;
};

@Injectable()
export class CloudinaryService {
  private readonly baseFolder = process.env.CLOUDINARY_FOLDER || 'athar-online';
  private readonly configured: boolean;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    this.configured = Boolean(cloudName && apiKey && apiSecret);

    if (this.configured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  async uploadImage(input: AthrImageUpload): Promise<UploadApiResponse> {
    this.assertConfigured();

    const options: UploadApiOptions = {
      folder: `${this.baseFolder}/${input.folder}`,
      resource_type: 'image',
      overwrite: false,
      unique_filename: true,
      use_filename: false,
      public_id: input.publicId,
    };

    return new Promise<UploadApiResponse>((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(options, (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload did not return a result.'));
          return;
        }

        resolve(result);
      });

      upload.end(input.buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    this.assertConfigured();
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException('Cloudinary is not configured on this environment.');
    }
  }
}
