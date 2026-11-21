-- CreateTable
CREATE TABLE "RankedQueue" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "rating" REAL NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roomCode" TEXT,
    CONSTRAINT "RankedQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RankedMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomCode" TEXT NOT NULL,
    "counted" BOOLEAN NOT NULL,
    "botSkill" INTEGER NOT NULL,
    "players" JSONB NOT NULL,
    "results" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);

-- CreateTable
CREATE TABLE "RankedResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "ratingBefore" REAL NOT NULL,
    "ratingAfter" REAL NOT NULL,
    "delta" REAL NOT NULL,
    "abandoned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RankedResult_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "RankedMatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RankedResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Room" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'LOBBY',
    "maxPlayers" INTEGER NOT NULL DEFAULT 6,
    "bots" INTEGER NOT NULL DEFAULT 0,
    "botSkill" INTEGER NOT NULL DEFAULT 20,
    "ranked" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Room_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Room" ("bots", "code", "createdAt", "hostId", "id", "maxPlayers", "name", "state", "status", "updatedAt", "version") SELECT "bots", "code", "createdAt", "hostId", "id", "maxPlayers", "name", "state", "status", "updatedAt", "version" FROM "Room";
DROP TABLE "Room";
ALTER TABLE "new_Room" RENAME TO "Room";
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");
CREATE INDEX "Room_status_updatedAt_idx" ON "Room"("status", "updatedAt");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rating" REAL NOT NULL DEFAULT 1200,
    "rankedGames" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_User" ("createdAt", "id", "passwordHash", "username") SELECT "createdAt", "id", "passwordHash", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE INDEX "User_rating_idx" ON "User"("rating");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "RankedMatch_roomCode_key" ON "RankedMatch"("roomCode");

-- CreateIndex
CREATE INDEX "RankedResult_userId_createdAt_idx" ON "RankedResult"("userId", "createdAt");
