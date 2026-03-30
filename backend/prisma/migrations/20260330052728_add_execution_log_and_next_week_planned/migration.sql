/*
  Warnings:

  - You are about to drop the column `role` on the `DeptPerson` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "SceneExecutionLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sceneId" INTEGER NOT NULL,
    "logDate" DATETIME NOT NULL,
    "executor" TEXT,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '完成',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SceneExecutionLog_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DeptPerson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "divisionId" INTEGER,
    "departmentId" INTEGER,
    "sectionId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeptPerson_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DeptPerson_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DeptPerson_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DeptPerson" ("active", "createdAt", "departmentId", "id", "name") SELECT "active", "createdAt", "departmentId", "id", "name" FROM "DeptPerson";
DROP TABLE "DeptPerson";
ALTER TABLE "new_DeptPerson" RENAME TO "DeptPerson";
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
    "priority" TEXT NOT NULL DEFAULT '中',
    "status" TEXT NOT NULL DEFAULT '規劃中',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "establishDate" DATETIME,
    "targetDate" DATETIME,
    "completedDate" DATETIME,
    "goLiveDate" DATETIME,
    "timeSavedHours" REAL,
    "actualTimeSavedHours" REAL,
    "actualDemandCount" INTEGER,
    "resultText" TEXT,
    "actualResultText" TEXT,
    "otherMetrics" TEXT,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "importHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "nextWeekPlanned" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Scene_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Scene_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Scene" ("active", "actualDemandCount", "actualResultText", "actualTimeSavedHours", "agentCategory", "completedDate", "createdAt", "demandCount", "departmentId", "developMethod", "developToolDesc", "directSupervisor", "establishDate", "finalDataExample", "goLiveDate", "id", "importHash", "inputDesc", "itAssisted", "itemNo", "maintainOrDevelop", "monthlyFrequency", "note", "otherMetrics", "outputDesc", "priority", "progress", "rawDataExample", "resultText", "sceneName", "sectionId", "seedOwners", "status", "targetDate", "taskOwners", "taskSteps", "timePerExecution", "timeSavedHours", "updatedAt") SELECT "active", "actualDemandCount", "actualResultText", "actualTimeSavedHours", "agentCategory", "completedDate", "createdAt", "demandCount", "departmentId", "developMethod", "developToolDesc", "directSupervisor", "establishDate", "finalDataExample", "goLiveDate", "id", "importHash", "inputDesc", "itAssisted", "itemNo", "maintainOrDevelop", "monthlyFrequency", "note", "otherMetrics", "outputDesc", "priority", "progress", "rawDataExample", "resultText", "sceneName", "sectionId", "seedOwners", "status", "targetDate", "taskOwners", "taskSteps", "timePerExecution", "timeSavedHours", "updatedAt" FROM "Scene";
DROP TABLE "Scene";
ALTER TABLE "new_Scene" RENAME TO "Scene";
CREATE UNIQUE INDEX "Scene_itemNo_key" ON "Scene"("itemNo");
CREATE UNIQUE INDEX "Scene_importHash_key" ON "Scene"("importHash");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roles" TEXT NOT NULL,
    "divisionId" INTEGER,
    "departmentId" INTEGER,
    "sectionId" INTEGER,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("active", "createdAt", "departmentId", "id", "mustChangePassword", "name", "password", "roles", "updatedAt", "username") SELECT "active", "createdAt", "departmentId", "id", "mustChangePassword", "name", "password", "roles", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
