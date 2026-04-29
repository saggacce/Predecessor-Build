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
    const patchName = v.name || 'Unknown';
    const patchType = v.patchType || 'UNKNOWN';
    
    await db.version.upsert({
      where: { predggId: v.id },
      update: { name: patchName, patchType: patchType, syncedAt: now },
      create: {
        predggId: v.id,
        name: patchName,
        releaseDate: new Date(v.releaseDate),
        patchType: patchType,
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
