import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks } from "date-fns";
import { prisma } from "@/lib/db";
import { errorResponse, formatDate, jsonResponse, todayString } from "@/lib/care/utils";
import { validateRunningRecord } from "@/lib/care/validations/schemas";
import { getRestDayTypeSet, getRestDayTypeValues } from "@/lib/care/services/running-types";
import {
  calculatePaceSeconds,
  calculateAveragePace,
  sumDistance,
  countRecords,
  findLongestRun,
  isActiveRun,
  normalizeRunningRecord,
} from "@/lib/care/calculations/running";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const days = parseInt(searchParams.get("days") ?? "30", 10);

    if (date) {
      const records = await prisma.runningRecord.findMany({
        where: { date },
        include: { splits: { orderBy: { splitNumber: "asc" } } },
        orderBy: { createdAt: "desc" },
      });
      return jsonResponse(records);
    }

    const records = await prisma.runningRecord.findMany({
      include: { splits: { orderBy: { splitNumber: "asc" } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });

    const today = todayString();
    const now = new Date();
    const weekStart = formatDate(startOfWeek(now, { weekStartsOn: 1 }));
    const weekEnd = formatDate(endOfWeek(now, { weekStartsOn: 1 }));
    const monthStart = formatDate(startOfMonth(now));
    const monthEnd = formatDate(endOfMonth(now));
    const last7 = formatDate(subDays(now, 7));
    const last30Start = formatDate(subDays(now, 29));
    const lastWeekStart = formatDate(startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }));
    const lastWeekEnd = formatDate(endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 }));

    const weekRecords = records.filter((r) => r.date >= weekStart && r.date <= weekEnd);
    const lastWeekRecords = records.filter((r) => r.date >= lastWeekStart && r.date <= lastWeekEnd);
    const recent30Records = records.filter((r) => r.date >= last30Start && r.date <= today);

    const restDayTypes = await getRestDayTypeSet();

    const weekDistance = sumDistance(weekRecords, restDayTypes);
    const lastWeekDistance = sumDistance(lastWeekRecords, restDayTypes);
    const monthRecords = records.filter(
      (r) => r.date >= monthStart && r.date <= monthEnd,
    );

    const stats = {
      weekDistance,
      monthDistance: sumDistance(
        records.filter((r) => r.date >= monthStart && r.date <= monthEnd),
        restDayTypes,
      ),
      last7DaysDistance: sumDistance(records.filter((r) => r.date >= last7), restDayTypes),
      last30DaysDistance: sumDistance(recent30Records, restDayTypes),
      weekCount: countRecords(weekRecords, weekStart, weekEnd, restDayTypes),
      monthCount: countRecords(monthRecords, monthStart, monthEnd, restDayTypes),
      recent30AveragePace: calculateAveragePace(recent30Records, restDayTypes),
      longestRun: findLongestRun(records, restDayTypes),
      lastWeekDistance,
      weekOverWeekChange: weekDistance - lastWeekDistance,
    };

    const chartStart = formatDate(subDays(now, days - 1));
    const chartRecords = records.filter((r) => r.date >= chartStart && r.date <= today);

    const distanceByDate = new Map<string, number>();
    const paceByDate = new Map<string, { totalDist: number; totalDur: number }>();

    for (const r of chartRecords) {
      if (!isActiveRun(r, restDayTypes)) continue;
      distanceByDate.set(r.date, (distanceByDate.get(r.date) ?? 0) + r.distance);
      const existing = paceByDate.get(r.date) ?? { totalDist: 0, totalDur: 0 };
      existing.totalDist += r.distance;
      existing.totalDur += r.durationSeconds;
      paceByDate.set(r.date, existing);
    }

    const distanceChart: { date: string; distance: number }[] = [];
    const paceChart: { date: string; pace: number | null }[] = [];

    for (let d = new Date(chartStart); d <= new Date(today); d.setDate(d.getDate() + 1)) {
      const dateStr = formatDate(d);
      distanceChart.push({ date: dateStr, distance: distanceByDate.get(dateStr) ?? 0 });
      const paceData = paceByDate.get(dateStr);
      paceChart.push({
        date: dateStr,
        pace: paceData
          ? calculatePaceSeconds(paceData.totalDist, paceData.totalDur)
          : null,
      });
    }

    return jsonResponse({ records, stats, distanceChart, paceChart });
  } catch (error) {
    console.error("GET /api/running:", error);
    return errorResponse("러닝 기록을 불러오지 못했습니다", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { splits, ...rest } = body;
    const restDayTypeValues = await getRestDayTypeValues();
    const parsed = validateRunningRecord(rest, restDayTypeValues);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? "유효하지 않은 입력입니다");
    }

    const restDayTypes = new Set(restDayTypeValues);
    const data = normalizeRunningRecord(parsed.data, restDayTypes);
    const avgPaceSeconds = calculatePaceSeconds(data.distance, data.durationSeconds);
    const activeSplits = restDayTypes.has(data.type) ? [] : splits;

    const record = await prisma.runningRecord.create({
      data: {
        ...data,
        avgPaceSeconds,
        splits: activeSplits?.length
          ? {
              create: activeSplits.map(
                (s: {
                  splitNumber: number;
                  distance: number;
                  durationSeconds: number;
                  heartRate?: number | null;
                  cadence?: number | null;
                }) => ({
                  ...s,
                  paceSeconds: calculatePaceSeconds(s.distance, s.durationSeconds),
                }),
              ),
            }
          : undefined,
      },
      include: { splits: { orderBy: { splitNumber: "asc" } } },
    });

    return jsonResponse(record, 201);
  } catch (error) {
    console.error("POST /api/running:", error);
    return errorResponse("러닝 기록을 저장하지 못했습니다", 500);
  }
}
