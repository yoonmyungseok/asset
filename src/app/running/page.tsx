"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/care/ui/Card";
import { Button } from "@/components/care/ui/Button";
import { Input } from "@/components/care/ui/Input";
import { Select } from "@/components/care/ui/Select";
import { StatCard } from "@/components/care/ui/StatCard";
import { Modal, ConfirmDialog } from "@/components/care/ui/Modal";
import { LoadingSpinner, EmptyState } from "@/components/care/ui/Loading";
import { RecordCard, MobileRecordList } from "@/components/care/ui/RecordCard";
import { RunningDistanceChart } from "@/components/care/charts/Charts";
import { useToast } from "@/components/care/ui/Toast";
import { formatPace, calculatePaceSeconds, formatDistanceChange } from "@/lib/care/calculations/running";
import { formatDisplayDate, formatDuration, parseDurationToSeconds, todayString } from "@/lib/care/utils";
import { getRunningTypeLabel, isRestDay } from "@/lib/care/constants";
import { formatRunningRecordText } from "@/lib/care/format/running-text";

interface RunningType {
  id: number;
  value: string;
  label: string;
  excludeFromStats: boolean;
  sortOrder: number;
}

interface RunningSplit {
  id?: number;
  splitNumber: number;
  distance: number;
  durationSeconds: number;
  paceSeconds?: number | null;
  heartRate?: number | null;
  cadence?: number | null;
}

interface RunningRecord {
  id: number;
  date: string;
  type: string;
  distance: number;
  durationSeconds: number;
  avgPaceSeconds: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  cadence: number | null;
  memo: string | null;
  splits: RunningSplit[];
}

interface RunningStats {
  weekDistance: number;
  monthDistance: number;
  last7DaysDistance: number;
  last30DaysDistance: number;
  weekCount: number;
  monthCount: number;
  recent30AveragePace: number | null;
  longestRun: { distance: number; date: string } | null;
  lastWeekDistance: number;
  weekOverWeekChange: number;
}

const emptyForm = {
  date: todayString(),
  type: "easy",
  distance: "",
  duration: "",
  avgHeartRate: "",
  maxHeartRate: "",
  cadence: "",
  memo: "",
};

const emptySplit = { splitNumber: 1, distance: "1", duration: "", heartRate: "", cadence: "" };

export default function RunningPage() {
  const { showToast } = useToast();
  const [records, setRecords] = useState<RunningRecord[]>([]);
  const [stats, setStats] = useState<RunningStats | null>(null);
  const [distanceChart, setDistanceChart] = useState<{ date: string; distance: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [splits, setSplits] = useState<typeof emptySplit[]>([]);
  const [saving, setSaving] = useState(false);
  const [runningTypes, setRunningTypes] = useState<RunningType[]>([]);
  const [exportingSheets, setExportingSheets] = useState(false);
  const [sheetsReady, setSheetsReady] = useState<boolean | null>(null);

  const restDayValues = runningTypes.filter((t) => t.excludeFromStats).map((t) => t.value);
  const typeOptions = runningTypes.map(({ value, label }) => ({ value, label }));

  const fetchData = useCallback(async () => {
    const [runningRes, typesRes] = await Promise.all([
      fetch("/api/running?days=30"),
      fetch("/api/running/types"),
    ]);
    const data = await runningRes.json();
    const types: RunningType[] = await typesRes.json();
    setRecords(data.records);
    setStats(data.stats);
    setDistanceChart(data.distanceChart);
    setRunningTypes(types);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetch("/api/integrations/google-sheets/status")
      .then((res) => res.json())
      .then((status) => setSheetsReady(Boolean(status.spreadsheetConfigured)))
      .catch(() => setSheetsReady(false));
  }, []);

  const exportToGoogleSheets = async () => {
    if (sheetsReady === false) {
      showToast(
        "스프레드시트 URL이 저장되지 않았습니다. 설정에서 URL 입력 후 「스프레드시트 설정 저장」을 눌러 주세요.",
        "error",
      );
      return;
    }
    setExportingSheets(true);
    try {
      const res = await fetch("/api/integrations/google-sheets/running/sync", {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        showToast(body.error ?? "보내기에 실패했습니다", "error");
        return;
      }
      const { running, splits } = body;
      setSheetsReady(true);
      showToast(
        `스프레드시트 갱신 완료 (러닝 추가 ${running.inserted} · 수정 ${running.updated}, 스플릿 추가 ${splits.inserted} · 수정 ${splits.updated})`,
      );
    } finally {
      setExportingSheets(false);
    }
  };

  const isRest = isRestDay(form.type, restDayValues);

  const computedPace = () => {
    const dist = parseFloat(form.distance);
    const dur = parseDurationToSeconds(form.duration);
    if (!dist || !dur) return null;
    return calculatePaceSeconds(dist, dur);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSplits([]);
    setModalOpen(true);
  };

  const openEdit = (record: RunningRecord) => {
    setEditingId(record.id);
    setForm({
      date: record.date,
      type: record.type,
      distance: isRestDay(record.type, restDayValues) ? "" : record.distance.toString(),
      duration: isRestDay(record.type, restDayValues) ? "" : formatDuration(record.durationSeconds),
      avgHeartRate: record.avgHeartRate?.toString() ?? "",
      maxHeartRate: record.maxHeartRate?.toString() ?? "",
      cadence: record.cadence?.toString() ?? "",
      memo: record.memo ?? "",
    });
    setSplits(
      isRestDay(record.type, restDayValues)
        ? []
        : record.splits.map((s) => ({
        splitNumber: s.splitNumber,
        distance: s.distance.toString(),
        duration: formatDuration(s.durationSeconds),
        heartRate: s.heartRate?.toString() ?? "",
        cadence: s.cadence?.toString() ?? "",
      })),
    );
    setModalOpen(true);
  };

  const handleTypeChange = (type: string) => {
    if (isRestDay(type, restDayValues)) {
      setForm({
        ...form,
        type,
        distance: "",
        duration: "",
        avgHeartRate: "",
        maxHeartRate: "",
        cadence: "",
      });
      setSplits([]);
      return;
    }

    setForm({ ...form, type });
  };

  const handleSave = async () => {
    if (isRest) {
      setSaving(true);
      const payload = {
        date: form.date,
        type: form.type,
        distance: 0,
        durationSeconds: 0,
        avgHeartRate: null,
        maxHeartRate: null,
        cadence: null,
        memo: form.memo || null,
        splits: [],
      };

      const url = editingId ? `/api/running/${editingId}` : "/api/running";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setSaving(false);

      if (!res.ok) {
        showToast(data.error ?? "저장에 실패했습니다", "error");
        return;
      }

      showToast(editingId ? "수정되었습니다" : "저장되었습니다");
      setModalOpen(false);
      fetchData();
      return;
    }

    const durationSeconds = parseDurationToSeconds(form.duration);
    if (!durationSeconds) {
      showToast("올바른 운동 시간을 입력해주세요 (MM:SS 또는 HH:MM:SS)", "error");
      return;
    }

    setSaving(true);
    const payload = {
      date: form.date,
      type: form.type,
      distance: parseFloat(form.distance),
      durationSeconds,
      avgHeartRate: form.avgHeartRate ? parseInt(form.avgHeartRate, 10) : null,
      maxHeartRate: form.maxHeartRate ? parseInt(form.maxHeartRate, 10) : null,
      cadence: form.cadence ? parseInt(form.cadence, 10) : null,
      memo: form.memo || null,
      splits: splits
        .filter((s) => s.distance && s.duration)
        .map((s) => {
          const dur = parseDurationToSeconds(s.duration);
          return {
            splitNumber: s.splitNumber,
            distance: parseFloat(s.distance),
            durationSeconds: dur!,
            heartRate: s.heartRate ? parseInt(s.heartRate, 10) : null,
            cadence: s.cadence ? parseInt(s.cadence, 10) : null,
          };
        }),
    };

    const url = editingId ? `/api/running/${editingId}` : "/api/running";
    const method = editingId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      showToast(data.error ?? "저장에 실패했습니다", "error");
      return;
    }

    showToast(editingId ? "수정되었습니다" : "저장되었습니다");
    setModalOpen(false);
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    const res = await fetch(`/api/running/${deleteId}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      showToast("삭제에 실패했습니다", "error");
      return;
    }
    showToast("삭제되었습니다");
    setConfirmOpen(false);
    setDeleteId(null);
    fetchData();
  };

  const addSplit = () => {
    setSplits([...splits, { ...emptySplit, splitNumber: splits.length + 1 }]);
  };

  const updateSplit = (index: number, field: string, value: string) => {
    const updated = [...splits];
    updated[index] = { ...updated[index], [field]: value };
    setSplits(updated);
  };

  const removeSplit = (index: number) => {
    setSplits(splits.filter((_, i) => i !== index).map((s, i) => ({ ...s, splitNumber: i + 1 })));
  };

  const copyRecord = async (record: RunningRecord) => {
    try {
      await navigator.clipboard.writeText(formatRunningRecordText(record, runningTypes));
      showToast("복사되었습니다");
    } catch {
      showToast("복사에 실패했습니다", "error");
    }
  };

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  return (
    <>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">러닝 기록</h1>
          <p className="text-sm text-slate-500">러닝 활동을 기록하고 분석하세요</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={exportToGoogleSheets}
              disabled={exportingSheets}
            >
              {exportingSheets ? "보내는 중..." : "구글 스프레드시트로보내기"}
            </Button>
            <Button onClick={openCreate} className="w-full sm:w-auto">
              + 기록 추가
            </Button>
          </div>
          {sheetsReady === false && (
            <Link href="/settings" className="text-xs text-amber-700 hover:underline sm:text-right">
              스프레드시트 URL 저장 필요 → 설정
            </Link>
          )}
        </div>
      </div>

      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="이번 주" value={`${stats.weekDistance.toFixed(1)} km`} />
          <StatCard label="이번 달" value={`${stats.monthDistance.toFixed(1)} km`} />
          <StatCard
            label="이번 주 횟수"
            value={`${stats.weekCount}회`}
            subValue={`이번 달 ${stats.monthCount}회`}
          />
          <StatCard
            label="최근 30일 페이스"
            value={formatPace(stats.recent30AveragePace)}
          />
          <StatCard
            label="최장 거리 (PR)"
            value={stats.longestRun ? `${stats.longestRun.distance.toFixed(1)} km` : "-"}
            subValue={stats.longestRun ? formatDisplayDate(stats.longestRun.date) : undefined}
          />
          <StatCard
            label="지난주 대비"
            value={formatDistanceChange(stats.weekOverWeekChange)}
            subValue={`이번 주 ${stats.weekDistance.toFixed(1)}km · 지난주 ${stats.lastWeekDistance.toFixed(1)}km`}
          />
        </div>
      )}

      <Card title="러닝 거리 그래프 (최근 30일)" className="mb-6">
        <RunningDistanceChart data={distanceChart} />
      </Card>

      <Card title="기록 목록">
        {records.length === 0 ? (
          <EmptyState message="아직 러닝 기록이 없습니다." />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-4">날짜</th>
                    <th className="pb-2 pr-4">종류</th>
                    <th className="pb-2 pr-4">거리</th>
                    <th className="pb-2 pr-4">시간</th>
                    <th className="pb-2 pr-4">페이스</th>
                    <th className="pb-2">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4">{formatDisplayDate(r.date)}</td>
                      <td className="py-3 pr-4">{getRunningTypeLabel(r.type, typeOptions)}</td>
                      <td className="py-3 pr-4 font-medium">
                        {isRestDay(r.type, restDayValues) ? "-" : `${r.distance.toFixed(1)} km`}
                      </td>
                      <td className="py-3 pr-4">
                        {isRestDay(r.type, restDayValues) ? "-" : formatDuration(r.durationSeconds)}
                      </td>
                      <td className="py-3 pr-4">
                        {isRestDay(r.type, restDayValues) ? "-" : formatPace(r.avgPaceSeconds)}
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => copyRecord(r)}>
                            복사
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                            수정
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeleteId(r.id);
                              setConfirmOpen(true);
                            }}
                          >
                            삭제
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <MobileRecordList>
              {records.map((r) => {
                const rest = isRestDay(r.type, restDayValues);

                return (
                  <RecordCard
                    key={r.id}
                    title={formatDisplayDate(r.date)}
                    highlight={
                      <span className="text-base font-medium text-slate-800">
                        {getRunningTypeLabel(r.type, typeOptions)}
                        {!rest && (
                          <span className="ml-2 text-slate-600">
                            {r.distance.toFixed(1)} km
                          </span>
                        )}
                      </span>
                    }
                    fields={
                      rest
                        ? undefined
                        : [
                            { label: "시간", value: formatDuration(r.durationSeconds) },
                            { label: "페이스", value: formatPace(r.avgPaceSeconds) },
                          ]
                    }
                    actions={
                      <>
                        <Button variant="ghost" size="sm" onClick={() => copyRecord(r)}>
                          복사
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                          수정
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteId(r.id);
                            setConfirmOpen(true);
                          }}
                        >
                          삭제
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </MobileRecordList>
          </>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "러닝 기록 수정" : "러닝 기록 추가"}
        size="lg"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="날짜"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Select
            label="러닝 종류"
            value={form.type}
            onChange={(e) => handleTypeChange(e.target.value)}
            options={typeOptions}
          />
          {isRest ? (
            <>
              <div className="sm:col-span-2">
                <Input
                  label="메모"
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                />
              </div>
              <p className="sm:col-span-2 text-sm text-slate-500">
                통계 제외 종류는 날짜와 메모만 기록합니다. 거리·페이스 통계에는 포함되지 않습니다.
              </p>
            </>
          ) : (
            <>
              <Input
                label="거리 (km)"
                type="number"
                step="0.1"
                value={form.distance}
                onChange={(e) => setForm({ ...form, distance: e.target.value })}
              />
              <Input
                label="운동 시간 (MM:SS 또는 HH:MM:SS)"
                placeholder="00:55:00"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
              />
              <div className="sm:col-span-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                평균 페이스: <strong>{formatPace(computedPace())}</strong>
              </div>
              <Input
                label="평균 심박수"
                type="number"
                value={form.avgHeartRate}
                onChange={(e) => setForm({ ...form, avgHeartRate: e.target.value })}
              />
              <Input
                label="최대 심박수"
                type="number"
                value={form.maxHeartRate}
                onChange={(e) => setForm({ ...form, maxHeartRate: e.target.value })}
              />
              <Input
                label="케이던스"
                type="number"
                value={form.cadence}
                onChange={(e) => setForm({ ...form, cadence: e.target.value })}
              />
              <Input
                label="메모"
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
              />
            </>
          )}
        </div>

        {!isRest && (
        <div className="mt-6">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">구간별 기록</h3>
          {splits.map((split, index) => {
            const d = parseFloat(split.distance);
            const dur = parseDurationToSeconds(split.duration);
            const splitPace = dur && d ? formatPace(calculatePaceSeconds(d, dur)) : "-";

            return (
              <div
                key={index}
                className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">
                    구간 {split.splitNumber}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => removeSplit(index)}>
                    삭제
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="거리 (km)"
                    type="number"
                    step="0.1"
                    placeholder="0.0"
                    value={split.distance}
                    onChange={(e) => updateSplit(index, "distance", e.target.value)}
                  />
                  <Input
                    label="시간"
                    placeholder="MM:SS"
                    value={split.duration}
                    onChange={(e) => updateSplit(index, "duration", e.target.value)}
                  />
                  <Input
                    label="심박수"
                    type="number"
                    value={split.heartRate}
                    onChange={(e) => updateSplit(index, "heartRate", e.target.value)}
                  />
                  <Input
                    label="케이던스"
                    type="number"
                    value={split.cadence}
                    onChange={(e) => updateSplit(index, "cadence", e.target.value)}
                  />
                </div>
                <div className="mt-3 border-t border-slate-200 pt-2 text-sm text-slate-500">
                  페이스: <strong className="text-slate-700">{splitPace}</strong>
                </div>
              </div>
            );
          })}
          <Button
            variant="secondary"
            size="sm"
            onClick={addSplit}
            className="mt-1 w-full sm:w-auto"
          >
            + 구간 추가
          </Button>
        </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => setModalOpen(false)}
            className="w-full sm:w-auto"
          >
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || (!isRest && (!form.distance || !form.duration))}
            className="w-full sm:w-auto"
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="기록 삭제"
        message="이 러닝 기록을 삭제하시겠습니까?"
        loading={saving}
      />
    </>
  );
}
