import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface UploadedImage {
  url: string;
  publicId: string;
}

/** Único lugar del proyecto que habla con Cloudinary. */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(config: ConfigService) {
    cloudinary.config({
      cloud_name: config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: config.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
      secure: true,
    });
  }

  /** Sube la imagen desde memoria (sin escribirla en disco). */
  upload(buffer: Buffer): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'nodo/memories',
          resource_type: 'image',
          // Tope de tamaño y compresión automática: ahorra espacio y datos móviles.
          transformation: [
            { width: 1600, height: 1600, crop: 'limit', quality: 'auto' },
          ],
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(
              `Fallo al subir imagen: ${error?.message ?? 'sin respuesta'}`,
            );
            reject(
              new InternalServerErrorException('No se pudo guardar la imagen'),
            );
            return;
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(buffer);
    });
  }

  /** Borra la imagen. Si falla solo se registra: no debe tumbar la petición. */
  async destroy(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch {
      this.logger.warn(`No se pudo borrar la imagen ${publicId}`);
    }
  }
}
