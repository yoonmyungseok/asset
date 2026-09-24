import type { PrismaClient } from "@prisma/client";
import { format, subDays } from "date-fns";

export async function runCareSeed(client: PrismaClient) {
  const count = await client.userSettings.count();
  if (count > 0) {
    console.log("Care seed skipped (UserSettings already exists)");
    return;
  }

  console.log("Seeding care (health) data...");

  await client.runningType.createMany({
    data: [
      { value: "easy", label: "이지런", excludeFromStats: false, sortOrder: 0 },
      { value: "recovery", label: "회복주", excludeFromStats: false, sortOrder: 1 },
      { value: "lsd", label: "LSD", excludeFromStats: false, sortOrder: 2 },
      { value: "rest", label: "휴식", excludeFromStats: true, sortOrder: 3 },
      { value: "tempo", label: "지속주", excludeFromStats: false, sortOrder: 4 },
    ],
  });

  await client.userSettings.create({
    data: {
      targetWeight: 68.0,
      targetCalories: 2000,
      targetCarbs: 250,
      targetProtein: 120,
      targetFat: 65,
    },
  });

  const today = new Date();
  const weightData = [];
  let baseWeight = 72.5;

  for (let i = 29; i >= 0; i--) {
    const date = format(subDays(today, i), "yyyy-MM-dd");
    const fluctuation = (Math.random() - 0.5) * 0.4;
    baseWeight += fluctuation * 0.3;
    if (i % 7 === 0) baseWeight -= 0.1;

    weightData.push({
      date,
      weight: Math.round(baseWeight * 10) / 10,
      steps: Math.floor(6000 + Math.random() * 8000),
      water: Math.round((1.5 + Math.random() * 1.5) * 10) / 10,
      sleep: Math.round((6 + Math.random() * 2.5) * 10) / 10,
      condition: ["good", "normal", "great"][Math.floor(Math.random() * 3)],
      bowelMovement: "normal",
      memo: i === 0 ? "오늘 기록" : null,
    });
  }

  await client.weightRecord.createMany({ data: weightData });

  const runningRecords = [
    {
      date: format(subDays(today, 1), "yyyy-MM-dd"),
      type: "easy",
      distance: 8.0,
      durationSeconds: 48 * 60,
      avgHeartRate: 145,
      maxHeartRate: 162,
      cadence: 172,
      memo: "이지런 8km",
    },
    {
      date: format(subDays(today, 3), "yyyy-MM-dd"),
      type: "tempo",
      distance: 10.0,
      durationSeconds: 55 * 60,
      avgHeartRate: 158,
      maxHeartRate: 175,
      cadence: 178,
      memo: "지속주 10km",
    },
  ];

  for (const record of runningRecords) {
    const paceSeconds = (record.durationSeconds / 60) / record.distance * 60;
    await client.runningRecord.create({
      data: {
        ...record,
        avgPaceSeconds: paceSeconds,
        splits: {
          create: [
            {
              splitNumber: 1,
              distance: record.distance / 2,
              durationSeconds: Math.floor(record.durationSeconds / 2),
              paceSeconds,
            },
            {
              splitNumber: 2,
              distance: record.distance / 2,
              durationSeconds: Math.ceil(record.durationSeconds / 2),
              paceSeconds,
            },
          ],
        },
      },
    });
  }

  const foodItems = [
    { name: "현미밥", standardAmount: "130g", calories: 210, carbs: 45, protein: 3, fat: 1.8, sodium: 15 },
    { name: "닭가슴살", standardAmount: "100g", calories: 165, carbs: 0, protein: 31, fat: 3.6, sodium: 74 },
    { name: "계란", standardAmount: "1개(50g)", calories: 78, carbs: 0.6, protein: 6.3, fat: 5.3, sodium: 62 },
    { name: "바나나", standardAmount: "1개(120g)", calories: 105, carbs: 27, protein: 1.3, fat: 0.4, sodium: 1 },
  ];

  await client.foodItem.createMany({ data: foodItems });

  const todayStr = format(today, "yyyy-MM-dd");
  const breakfast = await client.meal.create({
    data: { date: todayStr, mealType: "breakfast" },
  });
  await client.foodEntry.create({
    data: {
      mealId: breakfast.id,
      foodName: "현미밥",
      amount: 1,
      unit: "130g",
      calories: 210,
      carbs: 45,
      protein: 3,
      fat: 1.8,
      sodium: 15,
    },
  });

  console.log("Care seed completed");
}
