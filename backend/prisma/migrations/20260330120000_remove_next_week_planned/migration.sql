-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Scene" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemNo" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "sectionId" INTEGER,
    "sceneName" TEXT NOT NULL,
    "maintainOrDevelop" TEXT,
    "itAssisted" BOOLEAN,
    "developMethod" TEXT,
    "developToolDesc" TEXT,
    "agentCategory" TEXT,
    "inputDesc" TEXT,
    "outputDesc" TEXT,
    "taskSteps" TEXT,
    "rawDataExample" TEXT,
    "finalDataExample" TEXT,
    "timePerExecution" TEXT,
    "monthlyFrequency" TEXT,
    "demandCount" INTEGER,
    "taskOwners" TEXT,
    "seedOwners" TEXT,
    "directSupervisor" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'planning',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "establishDate" DATETIME,
    "targetDate" DATETIME,
    "completedDate" DATETIME,
    "goLiveDate" DATETIME,
    "timeSavedHours" REAL,
    "actualTimeSavedHours" REAL,
    "actualDemandCount" INTEGER,
    "efficiencyGainPct" REAL,
    "resultText" TEXT,
    "actualResultText" TEXT,
    "otherMetrics" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "importHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scene_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Scene" SELECT "id","itemNo","departmentId","sectionId","sceneName","maintainOrDevelop","itAssisted","developMethod","developToolDesc","agentCategory","inputDesc","outputDesc","taskSteps","rawDataExample","finalDataExample","timePerExecution","monthlyFrequency","demandCount","taskOwners","seedOwners","directSupervisor","priority","status","progress","establishDate","targetDate","completedDate","goLiveDate","timeSavedHours","actualTimeSavedHours","actualDemandCount","efficiencyGainPct","resultText","actualResultText","otherMetrics","note","active","importHash","createdAt","updatedAt" FROM "Scene";
DROP TABLE "Scene";
ALTER TABLE "new_Scene" RENAME TO "Scene";
CREATE UNIQUE INDEX "Scene_itemNo_key" ON "Scene"("itemNo");
CREATE UNIQUE INDEX "Scene_importHash_key" ON "Scene"("importHash");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
