import { Injectable } from '@nestjs/common';
import { VetManagerAdapter } from './adapters/vet-manager.adapter';
import { IMisAdapter, MisConfigurationError } from './interfaces/mis-adapter.interface';

@Injectable()
export class MisAdapterFactory {
  constructor(private readonly vetManagerAdapter: VetManagerAdapter) {}

  getAdapter(misType: string): IMisAdapter {
    switch (misType) {
      case 'VET_MANAGER_API':
        return this.vetManagerAdapter;
      default:
        throw new MisConfigurationError(`Unsupported MIS type: ${misType}`);
    }
  }
}
