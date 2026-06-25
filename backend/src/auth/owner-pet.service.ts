import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { JwtPayload } from './auth.types';

export type OwnerPet = {
  id: string;
  name: string;
  species: 'DOG' | 'CAT' | 'OTHER';
  createdAt: string;
};

@Injectable()
export class OwnerPetService {
  constructor(private readonly database: DatabaseService) {}

  async list(owner: JwtPayload): Promise<OwnerPet[]> {
    const result = await this.database.query<{
      id: string;
      name: string;
      species: OwnerPet['species'];
      created_at: Date;
    }>(`
      SELECT id, name, species, created_at
      FROM pet_schema.pets
      WHERE owner_id = $1::uuid
      ORDER BY created_at ASC, id ASC
    `, [owner.sub]);
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      species: row.species,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async create(owner: JwtPayload, input: { name: string; species: string }): Promise<OwnerPet> {
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({ code: 'INVALID_PET_NAME', message: 'name must not be blank.' });
    }
    const result = await this.database.query<{
      id: string;
      name: string;
      species: OwnerPet['species'];
      created_at: Date;
    }>(`
      INSERT INTO pet_schema.pets (owner_id, name, species)
      VALUES ($1::uuid, $2, $3)
      RETURNING id, name, species, created_at
    `, [owner.sub, name, input.species]);
    const pet = result.rows[0];
    return {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      createdAt: pet.created_at.toISOString(),
    };
  }
}
