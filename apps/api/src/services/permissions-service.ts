import { PrismaClient } from '@prisma/client';

// Roles whose permissions are configurable (SUPER_ADMIN is always full access)
export const CONFIGURABLE_ROLES = ['PLATFORM_ADMIN', 'MANAGER', 'COACH', 'ANALISTA', 'JUGADOR'] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

export type PermissionKey =
  | 'teams.own.view' | 'teams.own.create' | 'teams.own.edit' | 'teams.own.delete'
  | 'teams.own.addPlayer' | 'teams.own.removePlayer' | 'teams.own.editPlayerName' | 'teams.own.syncMatches'
  | 'teams.rival.view' | 'teams.rival.create' | 'teams.rival.edit' | 'teams.rival.delete'
  | 'teams.rival.addPlayer' | 'teams.rival.removePlayer' | 'teams.rival.syncMatches'
  | 'teamAnalysis.view' | 'teamAnalysis.performance' | 'teamAnalysis.draft'
  | 'teamAnalysis.vision' | 'teamAnalysis.analyst'
  | 'playerScouting.view' | 'playerScouting.syncPlayer' | 'playerScouting.editPlayerName'
  | 'playerGoals.view' | 'playerGoals.create' | 'playerGoals.edit' | 'playerGoals.delete'
  | 'matchDetail.view' | 'matchDetail.syncMatch' | 'matchDetail.editPlayerName'
  | 'matchDetail.scoreboard' | 'matchDetail.statistics' | 'matchDetail.timeline' | 'matchDetail.analysis'
  | 'scrimReport.view' | 'scrimReport.export'
  | 'reviewQueue.view' | 'reviewQueue.createItem' | 'reviewQueue.editItem' | 'reviewQueue.deleteItem'
  | 'teamGoals.view' | 'teamGoals.create' | 'teamGoals.edit' | 'teamGoals.delete'
  | 'vodIndex.view' | 'vodIndex.create' | 'vodIndex.edit' | 'vodIndex.delete'
  | 'invitations.view' | 'invitations.create' | 'invitations.revoke'
  | 'platformAdmin.view' | 'platformAdmin.dataControls' | 'platformAdmin.staff'
  | 'platformAdmin.auditLogs' | 'platformAdmin.feedback' | 'platformAdmin.permissions';

export type RolePermissions = Record<PermissionKey, boolean>;
export type PlatformPermissions = Record<ConfigurableRole, RolePermissions>;

export const DEFAULT_PERMISSIONS: PlatformPermissions = {
  PLATFORM_ADMIN: {
    'teams.own.view': true, 'teams.own.create': true, 'teams.own.edit': true, 'teams.own.delete': true,
    'teams.own.addPlayer': true, 'teams.own.removePlayer': true, 'teams.own.editPlayerName': true, 'teams.own.syncMatches': true,
    'teams.rival.view': true, 'teams.rival.create': true, 'teams.rival.edit': true, 'teams.rival.delete': true,
    'teams.rival.addPlayer': true, 'teams.rival.removePlayer': true, 'teams.rival.syncMatches': true,
    'teamAnalysis.view': true, 'teamAnalysis.performance': true, 'teamAnalysis.draft': true,
    'teamAnalysis.vision': true, 'teamAnalysis.analyst': true,
    'playerScouting.view': true, 'playerScouting.syncPlayer': true, 'playerScouting.editPlayerName': true,
    'playerGoals.view': true, 'playerGoals.create': true, 'playerGoals.edit': true, 'playerGoals.delete': true,
    'matchDetail.view': true, 'matchDetail.syncMatch': true, 'matchDetail.editPlayerName': true,
    'matchDetail.scoreboard': true, 'matchDetail.statistics': true, 'matchDetail.timeline': true, 'matchDetail.analysis': true,
    'scrimReport.view': true, 'scrimReport.export': true,
    'reviewQueue.view': true, 'reviewQueue.createItem': true, 'reviewQueue.editItem': true, 'reviewQueue.deleteItem': true,
    'teamGoals.view': true, 'teamGoals.create': true, 'teamGoals.edit': true, 'teamGoals.delete': true,
    'vodIndex.view': true, 'vodIndex.create': true, 'vodIndex.edit': true, 'vodIndex.delete': true,
    'invitations.view': true, 'invitations.create': true, 'invitations.revoke': true,
    'platformAdmin.view': true, 'platformAdmin.dataControls': true, 'platformAdmin.staff': true,
    'platformAdmin.auditLogs': true, 'platformAdmin.feedback': true, 'platformAdmin.permissions': true,
  },
  MANAGER: {
    'teams.own.view': true, 'teams.own.create': true, 'teams.own.edit': true, 'teams.own.delete': true,
    'teams.own.addPlayer': true, 'teams.own.removePlayer': true, 'teams.own.editPlayerName': true, 'teams.own.syncMatches': true,
    'teams.rival.view': true, 'teams.rival.create': true, 'teams.rival.edit': true, 'teams.rival.delete': true,
    'teams.rival.addPlayer': true, 'teams.rival.removePlayer': true, 'teams.rival.syncMatches': true,
    'teamAnalysis.view': true, 'teamAnalysis.performance': true, 'teamAnalysis.draft': true,
    'teamAnalysis.vision': true, 'teamAnalysis.analyst': true,
    'playerScouting.view': true, 'playerScouting.syncPlayer': true, 'playerScouting.editPlayerName': true,
    'playerGoals.view': true, 'playerGoals.create': true, 'playerGoals.edit': true, 'playerGoals.delete': true,
    'matchDetail.view': true, 'matchDetail.syncMatch': true, 'matchDetail.editPlayerName': true,
    'matchDetail.scoreboard': true, 'matchDetail.statistics': true, 'matchDetail.timeline': true, 'matchDetail.analysis': true,
    'scrimReport.view': true, 'scrimReport.export': true,
    'reviewQueue.view': true, 'reviewQueue.createItem': true, 'reviewQueue.editItem': true, 'reviewQueue.deleteItem': true,
    'teamGoals.view': true, 'teamGoals.create': true, 'teamGoals.edit': true, 'teamGoals.delete': true,
    'vodIndex.view': true, 'vodIndex.create': true, 'vodIndex.edit': true, 'vodIndex.delete': true,
    'invitations.view': true, 'invitations.create': true, 'invitations.revoke': true,
    'platformAdmin.view': false, 'platformAdmin.dataControls': false, 'platformAdmin.staff': false,
    'platformAdmin.auditLogs': false, 'platformAdmin.feedback': false, 'platformAdmin.permissions': false,
  },
  COACH: {
    'teams.own.view': true, 'teams.own.create': false, 'teams.own.edit': false, 'teams.own.delete': false,
    'teams.own.addPlayer': false, 'teams.own.removePlayer': false, 'teams.own.editPlayerName': true, 'teams.own.syncMatches': true,
    'teams.rival.view': true, 'teams.rival.create': false, 'teams.rival.edit': false, 'teams.rival.delete': false,
    'teams.rival.addPlayer': false, 'teams.rival.removePlayer': false, 'teams.rival.syncMatches': true,
    'teamAnalysis.view': true, 'teamAnalysis.performance': true, 'teamAnalysis.draft': true,
    'teamAnalysis.vision': true, 'teamAnalysis.analyst': true,
    'playerScouting.view': true, 'playerScouting.syncPlayer': true, 'playerScouting.editPlayerName': true,
    'playerGoals.view': true, 'playerGoals.create': true, 'playerGoals.edit': true, 'playerGoals.delete': false,
    'matchDetail.view': true, 'matchDetail.syncMatch': true, 'matchDetail.editPlayerName': true,
    'matchDetail.scoreboard': true, 'matchDetail.statistics': true, 'matchDetail.timeline': true, 'matchDetail.analysis': true,
    'scrimReport.view': true, 'scrimReport.export': true,
    'reviewQueue.view': true, 'reviewQueue.createItem': true, 'reviewQueue.editItem': true, 'reviewQueue.deleteItem': false,
    'teamGoals.view': true, 'teamGoals.create': true, 'teamGoals.edit': true, 'teamGoals.delete': false,
    'vodIndex.view': true, 'vodIndex.create': true, 'vodIndex.edit': true, 'vodIndex.delete': false,
    'invitations.view': false, 'invitations.create': false, 'invitations.revoke': false,
    'platformAdmin.view': false, 'platformAdmin.dataControls': false, 'platformAdmin.staff': false,
    'platformAdmin.auditLogs': false, 'platformAdmin.feedback': false, 'platformAdmin.permissions': false,
  },
  ANALISTA: {
    'teams.own.view': true, 'teams.own.create': false, 'teams.own.edit': false, 'teams.own.delete': false,
    'teams.own.addPlayer': false, 'teams.own.removePlayer': false, 'teams.own.editPlayerName': false, 'teams.own.syncMatches': false,
    'teams.rival.view': true, 'teams.rival.create': false, 'teams.rival.edit': false, 'teams.rival.delete': false,
    'teams.rival.addPlayer': false, 'teams.rival.removePlayer': false, 'teams.rival.syncMatches': false,
    'teamAnalysis.view': true, 'teamAnalysis.performance': true, 'teamAnalysis.draft': false,
    'teamAnalysis.vision': true, 'teamAnalysis.analyst': false,
    'playerScouting.view': true, 'playerScouting.syncPlayer': false, 'playerScouting.editPlayerName': false,
    'playerGoals.view': true, 'playerGoals.create': false, 'playerGoals.edit': false, 'playerGoals.delete': false,
    'matchDetail.view': true, 'matchDetail.syncMatch': false, 'matchDetail.editPlayerName': false,
    'matchDetail.scoreboard': true, 'matchDetail.statistics': true, 'matchDetail.timeline': true, 'matchDetail.analysis': true,
    'scrimReport.view': false, 'scrimReport.export': false,
    'reviewQueue.view': true, 'reviewQueue.createItem': true, 'reviewQueue.editItem': false, 'reviewQueue.deleteItem': false,
    'teamGoals.view': true, 'teamGoals.create': false, 'teamGoals.edit': false, 'teamGoals.delete': false,
    'vodIndex.view': true, 'vodIndex.create': false, 'vodIndex.edit': false, 'vodIndex.delete': false,
    'invitations.view': false, 'invitations.create': false, 'invitations.revoke': false,
    'platformAdmin.view': false, 'platformAdmin.dataControls': false, 'platformAdmin.staff': false,
    'platformAdmin.auditLogs': false, 'platformAdmin.feedback': false, 'platformAdmin.permissions': false,
  },
  JUGADOR: {
    'teams.own.view': true, 'teams.own.create': false, 'teams.own.edit': false, 'teams.own.delete': false,
    'teams.own.addPlayer': false, 'teams.own.removePlayer': false, 'teams.own.editPlayerName': false, 'teams.own.syncMatches': false,
    'teams.rival.view': false, 'teams.rival.create': false, 'teams.rival.edit': false, 'teams.rival.delete': false,
    'teams.rival.addPlayer': false, 'teams.rival.removePlayer': false, 'teams.rival.syncMatches': false,
    'teamAnalysis.view': false, 'teamAnalysis.performance': false, 'teamAnalysis.draft': false,
    'teamAnalysis.vision': false, 'teamAnalysis.analyst': false,
    'playerScouting.view': true, 'playerScouting.syncPlayer': false, 'playerScouting.editPlayerName': false,
    'playerGoals.view': true, 'playerGoals.create': false, 'playerGoals.edit': false, 'playerGoals.delete': false,
    'matchDetail.view': true, 'matchDetail.syncMatch': false, 'matchDetail.editPlayerName': false,
    'matchDetail.scoreboard': true, 'matchDetail.statistics': false, 'matchDetail.timeline': false, 'matchDetail.analysis': false,
    'scrimReport.view': false, 'scrimReport.export': false,
    'reviewQueue.view': false, 'reviewQueue.createItem': false, 'reviewQueue.editItem': false, 'reviewQueue.deleteItem': false,
    'teamGoals.view': true, 'teamGoals.create': false, 'teamGoals.edit': false, 'teamGoals.delete': false,
    'vodIndex.view': false, 'vodIndex.create': false, 'vodIndex.edit': false, 'vodIndex.delete': false,
    'invitations.view': false, 'invitations.create': false, 'invitations.revoke': false,
    'platformAdmin.view': false, 'platformAdmin.dataControls': false, 'platformAdmin.staff': false,
    'platformAdmin.auditLogs': false, 'platformAdmin.feedback': false, 'platformAdmin.permissions': false,
  },
};

export async function getPermissions(db: PrismaClient): Promise<PlatformPermissions> {
  const config = await (db as any).permissionsConfig.findUnique({ where: { id: 'global' } });
  if (!config) return DEFAULT_PERMISSIONS;
  return config.permissions as PlatformPermissions;
}

export async function savePermissions(
  db: PrismaClient,
  permissions: PlatformPermissions,
  updatedBy: string,
): Promise<void> {
  await (db as any).permissionsConfig.upsert({
    where: { id: 'global' },
    create: { id: 'global', permissions, updatedBy },
    update: { permissions, updatedBy },
  });
}
