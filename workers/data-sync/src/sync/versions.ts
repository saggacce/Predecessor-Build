import { PrismaClient } from '@prisma/client';
import { gql } from '../client.js';

interface PredggVersion {
  id: string;
  name: string;
  releaseDate: string;
  patchType: string;
}

const QUERY = `
  {
    versions {
      id
      name
      releaseDate
      patchType
    }
  }
`;

export async function syncVersions(db: PrismaClient): Promise<number> {
  const data = await gql<{ versions: PredggVersion[] }>(QUERY);
  const now = new Date();
  let upserted = 0;

  for (const v of data.versions) {
    await db.version.upsert({
      where: { predggId: v.id },
      update: { name: v.name, patchType: v.patchType, syncedAt: now },
      create: {
        predggId: v.id,
        name: v.name,
        releaseDate: new Date(v.releaseDate),
        patchType: v.patchType,
        syncedAt: now,
      },
    });

    await db.syncLog.create({
      data: { entity: 'version', entityId: v.id, operation: 'upsert', status: 'ok' },
    });

    upserted++;
  }

  return upserted;
}
