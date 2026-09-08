import { Module } from '@nestjs/common';
import { PublicCatalogController, PublicClinicController } from './public-catalog.controller';
import { PublicCatalogService } from './public-catalog.service';
import { OwnerClinicCatalogController } from './owner-clinic-catalog.controller';

@Module({
  controllers: [PublicCatalogController, PublicClinicController, OwnerClinicCatalogController],
  providers: [PublicCatalogService],
  exports: [PublicCatalogService],
})
export class PublicCatalogModule {}
