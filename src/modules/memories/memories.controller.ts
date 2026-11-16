import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { MemoriesService } from './memories.service';
import 'multer';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

/** Rutas de recuerdos: /api/v1/memories/... Todas requieren sesión. */
@ApiTags('Memories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('memories')
export class MemoriesController {
  constructor(private readonly memoriesService: MemoriesService) {}

  /** POST /memories → 201. Recibe la foto (campo "photo") y sus datos como multipart/form-data. */
  @Post()
  @UseInterceptors(
    FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: { type: 'string', format: 'binary' },
        title: { type: 'string', maxLength: 40 },
        lat: { type: 'number' },
        lng: { type: 'number' },
      },
    },
  })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMemoryDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_PHOTO_BYTES }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
      }),
    )
    photo: Express.Multer.File,
  ) {
    return this.memoriesService.create(user.sub, dto, photo);
  }

  /** GET /memories → mis recuerdos y los de mis viajes. */
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.memoriesService.findAllForUser(user.sub);
  }

  /** DELETE /memories/:id → 204. Solo el autor. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.memoriesService.remove(user.sub, id);
  }
}
