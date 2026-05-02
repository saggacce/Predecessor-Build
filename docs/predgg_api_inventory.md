# pred.gg GraphQL API — Full Inventory

**Generated:** 2026-05-02 23:22:06  
**Endpoint:** `https://pred.gg/gql`  
**Token:** ✅ provided

---

## Currently used by the application

These are the queries and mutations the app actively calls. For auth details see `apps/api/src/routes/auth.ts`.

### Queries in use

| Query | Where used | Auth required |
|-------|-----------|---------------|
| `player(by: {uuid})` | Player profile lookup by UUID | No |
| `playersPaginated(filter: {search})` | Player search by name | **Yes** |
| `players(by: [{id}])` | Batch player lookup | **Yes** |
| `leaderboardPaginated` | Top players by season | **Yes** |
| `versions` | Sync all game patches | No |
| `heroes` | Hero catalog | No |
| `items` | Item catalog | No |
| `ratings` | Ranked seasons | No |

### Mutations in use

| Mutation | Where used |
|----------|-----------|
| `authorize` | OAuth2 PKCE flow (via pred.gg/oauth2/authorize → /api/oauth2/token) |

### Token endpoint (REST, not GraphQL)

`POST https://pred.gg/api/oauth2/token` — exchanges authorization code + PKCE verifier for Bearer token.

---

## Schema overview
- **Queries:** 35
- **Mutations:** 63

## Queries

| Query | Args | Returns | Deprecated |
|-------|------|---------|------------|
| `application` | `id` | `Application` |  |
| `applicationsPaginated` | `limit`, `offset` | `PaginatedApplications` |  |
| `backend` |  | `Backend!` |  |
| `comment` | `id` | `Comment` |  |
| `communityChallenge` | `id` | `CommunityChallenge` |  |
| `connectionInfo` |  | `ConnectionInfo!` |  |
| `currentAuth` |  | `Authorization` |  |
| `currentUser` |  | `User` |  |
| `event` | `by` | `Event` |  |
| `events` | `filters` | `[]!` |  |
| `group` | `id` | `Group` |  |
| `groups` |  | `[Group!]` |  |
| `guide` | `by` | `Guide` |  |
| `guidesPaginated` | `filter`, `order`, `limit`, `offset` | `PaginatedGuides!` |  |
| `hero` | `by` | `Hero` |  |
| `heroes` |  | `[]!` |  |
| `item` | `by` | `Item` |  |
| `items` |  | `[]!` |  |
| `leaderboardPaginated` | `ratingId`, `ratingType`, `limit`, `offset`, `filter` | `PaginatedLeaderboard!` |  |
| `match` | `by` | `Match` |  |
| `matchSpoilerBlocks` | `includeRejected` | `[]!` |  |
| `perk` | `by` | `Perk` |  |
| `perks` |  | `[]!` |  |
| `player` | `by` | `Player` |  |
| `players` | `by` | `[Player]!` |  |
| `playersPaginated` | `filter`, `limit`, `offset` | `PaginatedPlayers!` |  |
| `prediction` | `id` | `Prediction` |  |
| `rating` | `by` | `Rating` |  |
| `ratingStatistic` | `ratingId`, `granularity`, `filter` | `RatingStatisticResult` |  |
| `ratings` |  | `[]!` |  |
| `team` | `id` | `Team` |  |
| `teams` |  | `[]!` |  |
| `user` | `by` | `User` |  |
| `version` | `by` | `Version` |  |
| `versions` |  | `[]!` |  |

## Mutations

| Mutation | Deprecated |
|----------|------------|
| `addPredictionQuestion` |  |
| `approvePlayerClaim` |  |
| `assignBracketNodeMatch` |  |
| `authorize` |  |
| `autoSolvePrediction` |  |
| `autoSolvePredictionQuestion` |  |
| `claimPlayer` |  |
| `createApplication` |  |
| `createBracket` |  |
| `createCommunityChallenge` |  |
| `createEvent` |  |
| `createEventEntry` |  |
| `createGroup` |  |
| `createGuide` |  |
| `createMatchSpoilerBlock` |  |
| `createPrediction` |  |
| `createTeam` |  |
| `createTophy` |  |
| `deleteBracket` |  |
| `deleteCommunityChallenge` |  |
| `deleteEvent` |  |
| `deleteGuide` |  |
| `deletePlayerCustomization` |  |
| `deleteTrophy` |  |
| `discourseSso` |  |
| `editEventEntries` |  |
| `editPrediction` |  |
| `editPredictionQuestions` |  |
| `liftMatchSpoilerBlock` |  |
| `linkProvider` |  |
| `linkProviderId` |  |
| `postComment` |  |
| `rateComment` |  |
| `rateGuide` |  |
| `resetApplicationSecret` |  |
| `restoreGuide` |  |
| `reviewMatchSpoilerBlock` |  |
| `setBracketNodeAutoProtect` |  |
| `setPredictionResults` |  |
| `startCheckout` |  |
| `submitPredictionAnswers` |  |
| `unassignBracketNodeMatch` |  |
| `unlinkProvider` |  |
| `updateApplication` |  |
| `updateBracketOrders` |  |
| `updateBracketScore` |  |
| `updateCommunityChallenge` |  |
| `updateEvent` |  |
| `updateFriendCode` |  |
| `updateGroup` |  |
| `updateGuide` |  |
| `updateGuideAuthor` |  |
| `updateGuideAuthorBulk` |  |
| `updatePlayerCustomization` |  |
| `updatePlayerName` |  |
| `updatePlayerSettings` |  |
| `updateProviderLink` |  |
| `updateTeam` |  |
| `updateTophy` |  |
| `updateUser` |  |
| `userAssignGroup` |  |
| `userRemoveGroup` |  |
| `viewGuide` |  |

---

## Access probe — public vs authenticated

| Query | Without token | With token |
|-------|---------------|------------|
| `heroes` | ✅ OK | ✅ OK |
| `hero` | ✅ OK | ✅ OK |
| `items` | ✅ OK | ✅ OK |
| `item` | ✅ OK | ✅ OK |
| `perks` | ✅ OK | ✅ OK |
| `versions` | ✅ OK | ✅ OK |
| `ratings` | ✅ OK | ✅ OK |
| `teams` | ✅ OK | ✅ OK |
| `events` | ✅ OK | ✅ OK |
| `groups` | ❌ Forbidden | ❌ Forbidden |
| `currentUser` | ❌ Forbidden | ✅ OK |
| `currentAuth` | ⚠️ null (query ok) | ✅ OK |
| `connectionInfo` | ❌ Forbidden | ❌ Forbidden |
| `backend` | ✅ OK | ✅ OK |
| `player` | ✅ OK | ✅ OK |
| `players` | ❌ Forbidden | ✅ OK |
| `playersPaginated` | ❌ Forbidden | ✅ OK |
| `leaderboardPaginated` | ❌ Forbidden | ✅ OK |
| `ratingStatistic` | ❌ Forbidden | ❌ Forbidden |
| `rating` | ✅ OK | ✅ OK |
| `version` | ✅ OK | ✅ OK |
| `team` | ✅ OK | ✅ OK |
| `matchSpoilerBlocks` | ❌ Forbidden | ❌ Forbidden |
| `guidesPaginated` | ❌ Forbidden | ❌ Forbidden |
| `applicationsPaginated` | ❌ Forbidden | ❌ Forbidden |

### Sample data (authenticated)

**`heroes`**
```json
{"heroes": [{"id": "25", "name": "Phase", "slug": "phase"}, {"id": "17", "name": "Riktor", "slug": "riktor"}, {"id": "9", "name": "Howitzer", "slug": "howitzer"}, {"id": "39", "name": "Boost", "slug":...
```

**`hero`**
```json
{"hero": {"id": "8", "name": "Grux", "slug": "grux"}}
```

**`items`**
```json
{"items": [{"id": "16", "name": "Brutallax", "slug": "brutallax"}, {"id": "182", "name": "StealthWard", "slug": "stealth-ward"}, {"id": "242", "name": "SyonicEcho", "slug": "syonic-echo"}, {"id": "269...
```

**`item`**
```json
{"item": {"id": "105", "name": "Ashbringer"}}
```

**`perks`**
```json
{"perks": [{"id": "137", "name": "Perk_Yin_DeflectBuff"}, {"id": "167", "name": "Perk_Aurora_CrystalWall"}, {"id": "193", "name": "Perk_Hemlock_ThornWhip"}, {"id": "175", "name": "Perk_Gadget_FDALevel...
```

**`versions`**
```json
{"versions": [{"id": "1", "name": "0.1", "releaseDate": "2022-11-30T16:02:43Z", "patchType": "CONTENT"}, {"id": "2", "name": "0.1.1", "releaseDate": "2022-12-02T14:12:15Z", "patchType": "HOTFIX"}, {"i...
```

**`ratings`**
```json
{"ratings": [{"id": "3", "name": "Season 0", "startTime": "2024-06-15T14:00:00Z", "endTime": "2025-04-28T09:00:00Z"}, {"id": "4", "name": "Season 1 - Split 1", "startTime": "2025-04-29T12:00:00Z", "en...
```

**`teams`**
```json
{"teams": [{"id": "wFqVsae", "name": "LegionOfOnlineTerror"}, {"id": "EoMGaxt", "name": "All That Remains"}, {"id": "xWFZ6gI", "name": "Yeetersons"}, {"id": "Z5RZjAS", "name": "Stay With Me"}, {"id": ...
```

**`events`**
```json
{"events": [{"id": "wNqVesa"}, {"id": "xCFD6gI"}, {"id": "S7GG2FP"}, {"id": "HPDCme4"}, {"id": "f69MQoR"}, {"id": "Gk4stZX"}, {"id": "wNqOsae"}, {"id": "dOPA0NW"}, {"id": "oDAVbQN"}, {"id": "FzNnY0d"}...
```

**`currentUser`**
```json
{"currentUser": {"id": "1642760d-c0a9-42c9-888b-18fd99babdb4", "name": "saggacce", "uuid": "1642760d-c0a9-42c9-888b-18fd99babdb4"}}
```

**`currentAuth`**
```json
{"currentAuth": {"scope": "offline_access profile", "roles": [], "provider": null}}
```

**`backend`**
```json
{"backend": {"commitHash": "c6ca2de1988c746fa4c3bb95b1cb41efed498967"}}
```

**`player`**
```json
{"player": {"id": "9ac7a82d-0dab-4ca3-ab4f-0ce1b269cd82", "name": "Heygan", "uuid": "9ac7a82d-0dab-4ca3-ab4f-0ce1b269cd82"}}
```

**`players`**
```json
{"players": [{"id": "9ac7a82d-0dab-4ca3-ab4f-0ce1b269cd82", "name": "Heygan"}]}
```

**`playersPaginated`**
```json
{"playersPaginated": {"results": [{"id": "4cce16d0-5101-499f-9136-3c122895fd0f", "name": "saggacce"}], "totalCount": 1}}
```

**`leaderboardPaginated`**
```json
{"leaderboardPaginated": {"results": [{"points": 2056.0, "rank": {"name": "Paragon"}, "player": {"id": "9ac7a82d-0dab-4ca3-ab4f-0ce1b269cd82", "name": "Heygan"}}, {"points": 2018.0, "rank": {"name": "...
```

**`rating`**
```json
{"rating": {"id": "11", "name": "Season 1 - Split 4", "startTime": "2026-02-24T14:00:00Z"}}
```

**`version`**
```json
{"version": {"id": "143", "name": "1.13.1+1", "releaseDate": "2026-04-15T16:08:41Z"}}
```

**`team`**
```json
{"team": {"id": "wFqVsae", "name": "LegionOfOnlineTerror"}}
```

---

## Type field inventory

### `Player`  (35 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `blockName` | `Boolean!` |  |
| `blockSearch` | `Boolean!` |  |
| `canEditFriendcode` | `Boolean!` |  |
| `canEditName` | `Boolean!` |  |
| `comments` | `[]!` |  |
| `commonPlayers` | `CommonPlayerResult` |  |
| `console` | `Float` |  |
| `customization` | `PlayerCustomization` |  |
| `eventPlayer` | `[]!` |  |
| `favHero` | `Hero` |  |
| `favRegion` | `Region` |  |
| `favRole` | `Role` |  |
| `firstPlayedAt` | `DateTime` |  |
| `friendCode` | `String` |  |
| `friendCodePublic` | `Boolean` |  |
| `gamemodeStatistics` | `PlayerGameModeStatisticResult` |  |
| `generalStatistic` | `PlayerGeneralStatisticResult` |  |
| `heroStatistics` | `PlayerHeroStatisticResult` |  |
| `id` | `ID!` |  |
| `intervalStatistics` | `PlayerIntervalStatisticResult` |  |
| `isBlocked` | `Boolean!` |  |
| `isNameConsole` | `Boolean!` |  |
| `lastPlayedAt` | `DateTime` |  |
| `matchesPaginated` | `PaginatedPlayerMatches` |  |
| `name` | `String` |  |
| `nameHistory` | `[]!` |  |
| `ratings` | `[]!` |  |
| `roleStatistics` | `PlayerRoleStatisticResult` |  |
| `showSocial` | `Boolean!` |  |
| `showStream` | `Boolean!` |  |
| `teamPlayer` | `[]!` |  |
| `user` | `User` |  |
| `userPublic` | `Boolean!` |  |
| `uuid` | `UUID!` |  |
| `uuidLegacy` | `UUID` |  |

### `PlayerGeneralStatistic`  (39 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `doubleKills` | `Int!` |  |
| `matchesPlayed` | `Int!` |  |
| `matchesWon` | `Int!` |  |
| `maxAssists` | `Int!` |  |
| `maxDeaths` | `Int!` |  |
| `maxDoubleKills` | `Int!` |  |
| `maxDuration` | `Int!` |  |
| `maxGold` | `Int!` |  |
| `maxHeroDamage` | `Int!` |  |
| `maxHeroDamageTaken` | `Int!` |  |
| `maxKillingSpree` | `Int!` |  |
| `maxKills` | `Int!` |  |
| `maxLargestCritical` | `Int` |  |
| `maxMinionsKilled` | `Int!` |  |
| `maxObjectiveDamage` | `Int!` |  |
| `maxPentaKills` | `Int!` |  |
| `maxQuadraKills` | `Int!` |  |
| `maxStructureDamage` | `Int!` |  |
| `maxTripleKills` | `Int!` |  |
| `maxWardsDestroyed` | `Int!` |  |
| `maxWardsPlaced` | `Int!` |  |
| `mostPlayedHero` | `Hero` |  |
| `mostPlayedRegion` | `Region` |  |
| `mostPlayedRole` | `Role` |  |
| `objectiveDamage` | `Int!` |  |
| `pentaKills` | `Int!` |  |
| `quadraKills` | `Int!` |  |
| `structureDamage` | `Int!` |  |
| `totalAssists` | `Int!` |  |
| `totalDeaths` | `Int!` |  |
| `totalGold` | `Int!` |  |
| `totalHeroDamage` | `Int!` |  |
| `totalHeroDamageTaken` | `Int!` |  |
| `totalKills` | `Int!` |  |
| `totalMinionsKilled` | `Int!` |  |
| `totalTime` | `Int!` |  |
| `totalWardsDestroyed` | `Int!` |  |
| `totalWardsPlaced` | `Int!` |  |
| `tripleKills` | `Int!` |  |

### `PlayerHeroStatistic`  (37 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `doubleKills` | `Int!` |  |
| `hero` | `Hero!` |  |
| `matchesPlayed` | `Int!` |  |
| `matchesWon` | `Int!` |  |
| `maxAssists` | `Int!` |  |
| `maxDeaths` | `Int!` |  |
| `maxDoubleKills` | `Int!` |  |
| `maxDuration` | `Int!` |  |
| `maxGold` | `Int!` |  |
| `maxHeroDamage` | `Int!` |  |
| `maxHeroDamageTaken` | `Int!` |  |
| `maxKillingSpree` | `Int!` |  |
| `maxKills` | `Int!` |  |
| `maxLargestCritical` | `Int` |  |
| `maxMinionsKilled` | `Int!` |  |
| `maxObjectiveDamage` | `Int!` |  |
| `maxPentaKills` | `Int!` |  |
| `maxQuadraKills` | `Int!` |  |
| `maxStructureDamage` | `Int!` |  |
| `maxTripleKills` | `Int!` |  |
| `maxWardsDestroyed` | `Int!` |  |
| `maxWardsPlaced` | `Int!` |  |
| `objectiveDamage` | `Int!` |  |
| `pentaKills` | `Int!` |  |
| `quadraKills` | `Int!` |  |
| `structureDamage` | `Int!` |  |
| `totalAssists` | `Int!` |  |
| `totalDeaths` | `Int!` |  |
| `totalGold` | `Int!` |  |
| `totalHeroDamage` | `Int!` |  |
| `totalHeroDamageTaken` | `Int!` |  |
| `totalKills` | `Int!` |  |
| `totalMinionsKilled` | `Int!` |  |
| `totalTime` | `Int!` |  |
| `totalWardsDestroyed` | `Int!` |  |
| `totalWardsPlaced` | `Int!` |  |
| `tripleKills` | `Int!` |  |

### `PlayerRoleStatistic`  (17 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `doubleKills` | `Int!` |  |
| `matchesPlayed` | `Int!` |  |
| `matchesWon` | `Int!` |  |
| `pentaKills` | `Int!` |  |
| `quadraKills` | `Int!` |  |
| `role` | `Role!` |  |
| `totalAssists` | `Int!` |  |
| `totalDeaths` | `Int!` |  |
| `totalGold` | `Int!` |  |
| `totalHeroDamage` | `Int!` |  |
| `totalHeroDamageTaken` | `Int!` |  |
| `totalKills` | `Int!` |  |
| `totalMinionsKilled` | `Int!` |  |
| `totalTime` | `Int!` |  |
| `totalWardsDestroyed` | `Int!` |  |
| `totalWardsPlaced` | `Int!` |  |
| `tripleKills` | `Int!` |  |

### `PlayerRating`  (15 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `id` | `ID!` |  |
| `peakPercentile` | `Float` |  |
| `peakPoints` | `Float` |  |
| `peakRank` | `Rank` |  |
| `peakRanking` | `Int` |  |
| `peakRatingData` | `[Float!]` |  |
| `peakTimestamp` | `DateTime!` |  |
| `percentile` | `Float` |  |
| `player` | `Player!` |  |
| `points` | `Float` |  |
| `rank` | `Rank` |  |
| `ranking` | `Int` |  |
| `rating` | `Rating!` |  |
| `ratingData` | `[Float!]` |  |
| `unranked` | `Boolean!` |  |

### `Match`  (16 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `duration` | `Int!` |  |
| `endReason` | `MatchEndReason!` |  |
| `endTime` | `DateTime!` |  |
| `gameMode` | `GameMode!` |  |
| `heroBans` | `[HeroBan!]` |  |
| `heroKills` | `[]!` |  |
| `id` | `ID!` |  |
| `matchPlayers` | `[]!` |  |
| `objectiveKills` | `[]!` |  |
| `region` | `Region` |  |
| `spoilerBlockedUntil` | `DateTime` |  |
| `startTime` | `DateTime!` |  |
| `structureDestructions` | `[]!` |  |
| `uuid` | `UUID!` |  |
| `version` | `Version!` |  |
| `winningTeam` | `MatchPlayerTeam!` |  |

### `MatchPlayer`  (58 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `abilityOrder` | `[]!` |  |
| `assists` | `Int!` |  |
| `crestHealingDone` | `Int` |  |
| `deaths` | `Int!` |  |
| `endTime` | `DateTime!` |  |
| `gold` | `Int!` |  |
| `goldEarnedAtInterval` | `[]!` |  |
| `goldSpent` | `Int!` |  |
| `hero` | `Hero` |  |
| `heroDamage` | `Int!` |  |
| `heroDamageTaken` | `Int!` |  |
| `heroData` | `HeroData` |  |
| `id` | `ID!` |  |
| `inventoryItemData` | `[ItemData]` |  |
| `itemHealingDone` | `Int` |  |
| `kills` | `Int!` |  |
| `laneMinionsKilled` | `Int!` |  |
| `largestCriticalStrike` | `Int` |  |
| `largestKillingSpree` | `Int!` |  |
| `level` | `Int` |  |
| `magicalDamageDealt` | `Int!` |  |
| `magicalDamageDealtToHeroes` | `Int!` |  |
| `magicalDamageTaken` | `Int!` |  |
| `magicalDamageTakenFromHeroes` | `Int!` |  |
| `match` | `Match!` |  |
| `minionsKilled` | `Int!` |  |
| `multiKill` | `Int!` |  |
| `name` | `String` |  |
| `neutralMinionsEnemyJungle` | `Int!` |  |
| `neutralMinionsKilled` | `Int!` |  |
| `neutralMinionsTeamJungle` | `Int!` |  |
| `perkData` | `[PerkData]` |  |
| `perks` | `[Perk]` |  |
| `physicalDamageDealt` | `Int!` |  |
| `physicalDamageDealtToHeroes` | `Int!` |  |
| `physicalDamageTaken` | `Int!` |  |
| `physicalDamageTakenFromHeroes` | `Int!` |  |
| `player` | `Player!` |  |
| `rating` | `MatchPlayerRating` |  |
| `role` | `Role` |  |
| `team` | `MatchPlayerTeam!` |  |
| `totalDamageDealt` | `Int!` |  |
| `totalDamageDealtToObjectives` | `Int!` |  |
| `totalDamageDealtToStructures` | `Int!` |  |
| `totalDamageMitigated` | `Int!` |  |
| `totalDamageTaken` | `Int!` |  |
| `totalHealingDone` | `Int!` |  |
| `totalShieldingReceived` | `Int` |  |
| `transactions` | `[]!` |  |
| `trueDamageDealt` | `Int!` |  |
| `trueDamageDealtToHeroes` | `Int!` |  |
| `trueDamageTaken` | `Int!` |  |
| `trueDamageTakenFromHeroes` | `Int!` |  |
| `utilityHealingDone` | `Int` |  |
| `wardDestructions` | `[]!` |  |
| `wardPlacements` | `[]!` |  |
| `wardsDestroyed` | `Int!` |  |
| `wardsPlaced` | `Int!` |  |

### `Hero`  (11 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `availableVersions` | `[]!` |  |
| `coreBuild` | `HeroCoreBuildResult` |  |
| `data` | `HeroData` |  |
| `generalStatistic` | `HeroGeneralStatisticResult` |  |
| `id` | `ID!` |  |
| `leaderboard` | `HeroLeaderboardResult` |  |
| `matchesPaginated` | `PaginatedHeroMatches!` |  |
| `matchupStatistic` | `HeroMatchupStatisticResult` |  |
| `name` | `String!` |  |
| `simpleBuild` | `HeroSimpleBuildResult` |  |
| `slug` | `String` |  |

### `Item`  (5 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `availableVersions` | `[]!` |  |
| `data` | `ItemData` |  |
| `id` | `ID!` |  |
| `name` | `String!` |  |
| `slug` | `String` |  |

### `Perk`  (4 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `availableVersions` | `[]!` |  |
| `data` | `PerkData` |  |
| `id` | `ID!` |  |
| `name` | `String!` |  |

### `Version`  (15 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `build` | `Int` |  |
| `changelist` | `Int` |  |
| `changelistReplay` | `Int` |  |
| `gameString` | `String` |  |
| `heroData` | `[]!` |  |
| `id` | `ID!` |  |
| `itemData` | `[]!` |  |
| `name` | `String` |  |
| `patchNotesUrl` | `String` |  |
| `patchType` | `PatchType` |  |
| `perkData` | `[]!` |  |
| `releaseDate` | `DateTime` |  |
| `rollbackDate` | `DateTime` |  |
| `steamBuild` | `Int` |  |
| `steamManifest` | `String` |  |

### `Rating`  (7 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `endTime` | `DateTime` |  |
| `group` | `String` |  |
| `id` | `ID!` |  |
| `name` | `String!` |  |
| `ranks` | `[]!` |  |
| `startTime` | `DateTime` |  |
| `suffix` | `String!` |  |

### `Team`  (6 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `abbreviation` | `String` |  |
| `eventEntries` | `[]!` |  |
| `id` | `ID!` |  |
| `image` | `UploadedFile` |  |
| `name` | `String!` |  |
| `teamPlayers` | `[]!` |  |

### `User`  (13 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `applications` | `[]!` |  |
| `canEdit` | `Boolean!` |  |
| `country` | `String` |  |
| `countryPublic` | `Boolean!` |  |
| `groups` | `[Group!]` |  |
| `id` | `ID!` |  |
| `name` | `String!` |  |
| `playerCustomizations` | `[]!` |  |
| `players` | `[]!` |  |
| `predictionEntries` | `[]!` |  |
| `predictionEntry` | `PredictionEntry` |  |
| `providerLinks` | `[]!` |  |
| `uuid` | `UUID!` |  |

### `Application`  (11 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `allowUser` | `Boolean!` |  |
| `callbacks` | `[]!` |  |
| `canManage` | `Boolean!` |  |
| `clientId` | `String!` |  |
| `clientSecret` | `String!` |  |
| `confidential` | `Boolean!` |  |
| `id` | `ID!` |  |
| `name` | `String!` |  |
| `scopes` | `[]!` |  |
| `skipConsent` | `Boolean!` |  |
| `user` | `User!` |  |

### `Rank`  (9 fields)

| Field | Type | Deprecated |
|-------|------|------------|
| `abbreviation` | `String!` |  |
| `divisionIdx` | `Int!` |  |
| `icon` | `String!` |  |
| `id` | `ID!` |  |
| `name` | `String!` |  |
| `ratingMax` | `Float!` |  |
| `ratingMin` | `Float!` |  |
| `tierIdx` | `Int!` |  |
| `tierName` | `String!` |  |

---

## Summary

### ✅ Public (no auth required) — 14 queries

- `heroes`
- `hero`
- `items`
- `item`
- `perks`
- `versions`
- `ratings`
- `teams`
- `events`
- `backend`
- `player`
- `rating`
- `version`
- `team`

### 🔑 Unlocked with Bearer token — 5 queries

- `currentUser`
- `currentAuth`
- `players`
- `playersPaginated`
- `leaderboardPaginated`

### ❌ Still inaccessible — 6 queries

- `groups` → ❌ Forbidden
- `connectionInfo` → ❌ Forbidden
- `ratingStatistic` → ❌ Forbidden
- `matchSpoilerBlocks` → ❌ Forbidden
- `guidesPaginated` → ❌ Forbidden
- `applicationsPaginated` → ❌ Forbidden

