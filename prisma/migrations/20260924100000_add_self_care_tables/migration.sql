-- CreateTable
CREATE TABLE "UserSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "targetWeight" REAL NOT NULL DEFAULT 70.0,
    "birthYear" INTEGER NOT NULL DEFAULT 1993,
    "gender" TEXT NOT NULL DEFAULT 'male',
    "heightCm" REAL NOT NULL DEFAULT 176.0,
    "activityLevel" TEXT NOT NULL DEFAULT 'moderate',
    "targetCalories" REAL NOT NULL DEFAULT 2000.0,
    "targetCarbs" REAL NOT NULL DEFAULT 250.0,
    "targetProtein" REAL NOT NULL DEFAULT 120.0,
    "targetFat" REAL NOT NULL DEFAULT 65.0,
    "googleSpreadsheetId" TEXT,
    "googleRunningSheetName" TEXT NOT NULL DEFAULT '러닝',
    "googleRunningSplitSheetName" TEXT NOT NULL DEFAULT '러닝_스플릿',
    "googleRunningHeaderMap" TEXT,
    "googleRunningSplitHeaderMap" TEXT,
    "googleRunningUpsertKey" TEXT NOT NULL DEFAULT 'record_id',
    "googleRunningSplitUpsertKey" TEXT NOT NULL DEFAULT 'record_id_split',
    "googleSheetsLastSyncedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WeightRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "steps" INTEGER,
    "water" REAL,
    "sleep" REAL,
    "condition" TEXT,
    "bowelMovement" TEXT,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RunningType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "excludeFromStats" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RunningRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "distance" REAL NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "avgPaceSeconds" REAL,
    "avgHeartRate" INTEGER,
    "maxHeartRate" INTEGER,
    "cadence" INTEGER,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RunningSplit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "runningRecordId" INTEGER NOT NULL,
    "splitNumber" INTEGER NOT NULL,
    "distance" REAL NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "paceSeconds" REAL,
    "heartRate" INTEGER,
    "cadence" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RunningSplit_runningRecordId_fkey" FOREIGN KEY ("runningRecordId") REFERENCES "RunningRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FoodEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mealId" INTEGER NOT NULL,
    "foodName" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "calories" REAL NOT NULL,
    "carbs" REAL NOT NULL,
    "protein" REAL NOT NULL,
    "fat" REAL NOT NULL,
    "sodium" REAL,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FoodEntry_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FoodItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "standardAmount" TEXT NOT NULL,
    "calories" REAL NOT NULL,
    "carbs" REAL NOT NULL,
    "protein" REAL NOT NULL,
    "fat" REAL NOT NULL,
    "sodium" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "WeightRecord_date_key" ON "WeightRecord"("date");

-- CreateIndex
CREATE INDEX "WeightRecord_date_idx" ON "WeightRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "RunningType_value_key" ON "RunningType"("value");

-- CreateIndex
CREATE INDEX "RunningRecord_date_idx" ON "RunningRecord"("date");

-- CreateIndex
CREATE INDEX "RunningSplit_runningRecordId_idx" ON "RunningSplit"("runningRecordId");

-- CreateIndex
CREATE INDEX "Meal_date_idx" ON "Meal"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Meal_date_mealType_key" ON "Meal"("date", "mealType");

-- CreateIndex
CREATE INDEX "FoodEntry_mealId_idx" ON "FoodEntry"("mealId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodItem_name_key" ON "FoodItem"("name");
