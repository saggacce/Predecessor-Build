CREATE TABLE "GameItem" (
  "id" TEXT NOT NULL,
  "predggId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  CONSTRAINT "GameItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameItemVersion" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "predggDataId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "rarity" TEXT NOT NULL,
  "slotType" TEXT NOT NULL,
  "heroClass" TEXT NOT NULL,
  "aggressionType" TEXT,
  "price" INTEGER NOT NULL,
  "totalPrice" INTEGER NOT NULL,
  "isEvolved" BOOLEAN NOT NULL,
  "isHidden" BOOLEAN NOT NULL,
  "icon" TEXT,
  "smallIcon" TEXT,
  "stats" JSONB NOT NULL,
  "effects" JSONB NOT NULL,
  "buildsFromIds" JSONB NOT NULL,
  "buildsIntoIds" JSONB NOT NULL,
  "blockedByIds" JSONB NOT NULL,
  "blocksIds" JSONB NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GameItemVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GamePerk" (
  "id" TEXT NOT NULL,
  "predggId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  CONSTRAINT "GamePerk_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GamePerkVersion" (
  "id" TEXT NOT NULL,
  "perkId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "predggDataId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "slot" TEXT NOT NULL,
  "icon" TEXT,
  "iconCenterPosition" JSONB,
  "simpleDescription" TEXT,
  "description" TEXT NOT NULL,
  "aggressionTypes" JSONB NOT NULL,
  "displayOrder" INTEGER NOT NULL,
  "unlockLevel" INTEGER,
  "heroSlug" TEXT,
  "eternalCategoryPredggId" TEXT,
  "minorBlessingPredggIds" JSONB NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GamePerkVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EternalCategory" (
  "id" TEXT NOT NULL,
  "predggId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "EternalCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EternalCategoryVersion" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "predggDataId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "displayNameSingular" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "perkPredggIds" JSONB NOT NULL,
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EternalCategoryVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GameItem_predggId_key" ON "GameItem"("predggId");
CREATE UNIQUE INDEX "GameItem_slug_key" ON "GameItem"("slug");
CREATE UNIQUE INDEX "GameItemVersion_itemId_versionId_key" ON "GameItemVersion"("itemId", "versionId");
CREATE INDEX "GameItemVersion_versionId_isHidden_rarity_idx" ON "GameItemVersion"("versionId", "isHidden", "rarity");
CREATE INDEX "GameItemVersion_aggressionType_idx" ON "GameItemVersion"("aggressionType");
CREATE UNIQUE INDEX "GamePerk_predggId_key" ON "GamePerk"("predggId");
CREATE UNIQUE INDEX "GamePerk_slug_key" ON "GamePerk"("slug");
CREATE UNIQUE INDEX "GamePerkVersion_perkId_versionId_key" ON "GamePerkVersion"("perkId", "versionId");
CREATE INDEX "GamePerkVersion_versionId_slot_idx" ON "GamePerkVersion"("versionId", "slot");
CREATE INDEX "GamePerkVersion_heroSlug_idx" ON "GamePerkVersion"("heroSlug");
CREATE INDEX "GamePerkVersion_eternalCategoryPredggId_idx" ON "GamePerkVersion"("eternalCategoryPredggId");
CREATE UNIQUE INDEX "EternalCategory_predggId_key" ON "EternalCategory"("predggId");
CREATE UNIQUE INDEX "EternalCategory_name_key" ON "EternalCategory"("name");
CREATE UNIQUE INDEX "EternalCategoryVersion_categoryId_versionId_key" ON "EternalCategoryVersion"("categoryId", "versionId");
CREATE INDEX "EternalCategoryVersion_versionId_idx" ON "EternalCategoryVersion"("versionId");

ALTER TABLE "GameItemVersion" ADD CONSTRAINT "GameItemVersion_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "GameItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameItemVersion" ADD CONSTRAINT "GameItemVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GamePerkVersion" ADD CONSTRAINT "GamePerkVersion_perkId_fkey" FOREIGN KEY ("perkId") REFERENCES "GamePerk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GamePerkVersion" ADD CONSTRAINT "GamePerkVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EternalCategoryVersion" ADD CONSTRAINT "EternalCategoryVersion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EternalCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EternalCategoryVersion" ADD CONSTRAINT "EternalCategoryVersion_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
