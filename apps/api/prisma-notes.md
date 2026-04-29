// This package re-uses the Prisma schema from @predecessor/data-sync.
// The prisma directory here is a symlink or the schema path is
// configured via the PRISMA_SCHEMA_PATH environment variable.
//
// For local development, generate the client from the data-sync schema:
//   cd workers/data-sync && npx prisma generate
//
// The @prisma/client package is shared across the monorepo.
