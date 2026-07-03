exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE pet_schema.pet_documents
      ADD COLUMN IF NOT EXISTS file_name text,
      ADD COLUMN IF NOT EXISTS mime_type text,
      ADD COLUMN IF NOT EXISTS file_size_bytes integer,
      ADD COLUMN IF NOT EXISTS storage_key text,
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

    ALTER TABLE pet_schema.pet_documents
      DROP CONSTRAINT IF EXISTS pet_documents_doc_type_check;
    ALTER TABLE pet_schema.pet_documents
      ADD CONSTRAINT pet_documents_doc_type_check
      CHECK (doc_type IN ('PASSPORT', 'HISTORY', 'PET_PHOTO'));

    ALTER TABLE pet_schema.pet_documents
      DROP CONSTRAINT IF EXISTS pet_documents_file_size_check;
    ALTER TABLE pet_schema.pet_documents
      ADD CONSTRAINT pet_documents_file_size_check
      CHECK (file_size_bytes IS NULL OR file_size_bytes > 0);

    CREATE INDEX IF NOT EXISTS pet_documents_owner_download_idx
      ON pet_schema.pet_documents (owner_id, pet_id, id)
      WHERE deleted_at IS NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS pet_schema.pet_documents_owner_download_idx;

    ALTER TABLE pet_schema.pet_documents
      DROP CONSTRAINT IF EXISTS pet_documents_file_size_check;

    DELETE FROM pet_schema.pet_documents
    WHERE doc_type = 'PET_PHOTO';

    ALTER TABLE pet_schema.pet_documents
      DROP CONSTRAINT IF EXISTS pet_documents_doc_type_check;
    ALTER TABLE pet_schema.pet_documents
      ADD CONSTRAINT pet_documents_doc_type_check
      CHECK (doc_type IN ('PASSPORT', 'HISTORY'));

    ALTER TABLE pet_schema.pet_documents
      DROP COLUMN IF EXISTS deleted_at,
      DROP COLUMN IF EXISTS storage_key,
      DROP COLUMN IF EXISTS file_size_bytes,
      DROP COLUMN IF EXISTS mime_type,
      DROP COLUMN IF EXISTS file_name;
  `);
};
