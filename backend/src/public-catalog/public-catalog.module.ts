import { Module } from '@nestjs/common';
import { PublicCatalogController, PublicClinicController } from './public-catalog.controller';
import { PublicCatalogService } from './public-catalog.service';

@Module({
  controllers: [PublicCatalogController, PublicClinicController],
  providers: [PublicCatalogService],
  exports: [PublicCatalogService],
})
export class PublicCatalogModule {}
