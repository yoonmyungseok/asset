"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/care/ui/Card";
import { Button } from "@/components/care/ui/Button";
import { Input } from "@/components/care/ui/Input";
import { Select } from "@/components/care/ui/Select";
import { StatCard } from "@/components/care/ui/StatCard";
import { Modal, ConfirmDialog } from "@/components/care/ui/Modal";
import { LoadingSpinner, EmptyState } from "@/components/care/ui/Loading";
import { RecordCard, MobileRecordList } from "@/components/care/ui/RecordCard";
import { WeightChart } from "@/components/care/charts/Charts";
import { useToast } from "@/components/care/ui/Toast";
import {
  buildWeightDayChanges,
  formatWeightChange,
  getWeightChangeClassName,
  getWeightChangeTrend,
} from "@/lib/care/calculations/weight";
import { formatDisplayDate, todayString } from "@/lib/care/utils";
import { CONDITION_OPTIONS, BOWEL_OPTIONS } from "@/lib/care/constants";

interface WeightRecord {
  id: number;
  date: string;
  weight: number;
  steps: number | null;
  water: number | null;
  sleep: number | null;
  condition: string | null;
  bowelMovement: string | null;
  memo: string | null;
}

interface WeightStats {
  current: number | null;
  changeFromPrevious: number | null;
  changeFromFirst: number | null;
  change7Days: number | null;
  change30Days: number | null;
  targetWeight: number;
  remainingToTarget: number | null;
}

const emptyForm = {
  date: todayString(),
  weight: "",
  steps: "",
  water: "",
  sleep: "",
  condition: "",
  bowelMovement: "",
  memo: "",
};

export default function WeightPage() {
  const { showToast } = useToast();
  const [records, setRecords] = useState<WeightRecord[]>([]);
  const [stats, setStats] = useState<WeightStats | null>(null);
  const [chartData, setChartData] = useState<{ date: string; weight: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const dayChanges = useMemo(() => buildWeightDayChanges(records), [records]);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/weight?days=30");
    const data = await res.json();
    setRecords(data.records);
    setStats(data.stats);
    setChartData(data.chartData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (record: WeightRecord) => {
    setEditingId(record.id);
    setForm({
      date: record.date,
      weight: record.weight.toString(),
      steps: record.steps?.toString() ?? "",
      water: record.water?.toString() ?? "",
      sleep: record.sleep?.toString() ?? "",
      condition: record.condition ?? "",
      bowelMovement: record.bowelMovement ?? "",
      memo: record.memo ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      date: form.date,
      weight: parseFloat(form.weight),
      steps: form.steps ? parseInt(form.steps, 10) : null,
      water: form.water ? parseFloat(form.water) : null,
      sleep: form.sleep ? parseFloat(form.sleep) : null,
      condition: form.condition || null,
      bowelMovement: form.bowelMovement || null,
      memo: form.memo || null,
    };

    const url = editingId ? `/api/weight/${editingId}` : "/api/weight";
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
    const res = await fetch(`/api/weight/${deleteId}`, { method: "DELETE" });
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

  if (loading) {
    return (
      <LoadingSpinner />
    );
  }

  return (
    <>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">체중 관리</h1>
          <p className="text-sm text-slate-500">체중과 건강 지표를 기록하세요</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          + 기록 추가
        </Button>
      </div>

      {stats && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="현재 체중"
            value={stats.current != null ? `${stats.current.toFixed(1)} kg` : "-"}
            subValue={
              stats.changeFromPrevious != null
                ? `전일 ${formatWeightChange(stats.changeFromPrevious)}`
                : undefined
            }
            trend={getWeightChangeTrend(stats.changeFromPrevious)}
            valueTrend={getWeightChangeTrend(stats.changeFromPrevious)}
          />
          <StatCard
            label="목표까지"
            value={
              stats.remainingToTarget != null
                ? `${stats.remainingToTarget > 0 ? "+" : ""}${stats.remainingToTarget.toFixed(1)} kg`
                : "-"
            }
            subValue={`목표 ${stats.targetWeight.toFixed(1)} kg`}
          />
          <StatCard
            label="7일 변화"
            value={formatWeightChange(stats.change7Days)}
            valueTrend={getWeightChangeTrend(stats.change7Days)}
          />
          <StatCard
            label="30일 변화"
            value={formatWeightChange(stats.change30Days)}
            valueTrend={getWeightChangeTrend(stats.change30Days)}
          />
        </div>
      )}

      <Card title="체중 변화 그래프" className="mb-6">
        <div className="h-[220px] sm:h-[280px] [&_.recharts-responsive-container]:!h-full">
          <WeightChart data={chartData} />
        </div>
      </Card>

      <Card title="기록 목록">
        {records.length === 0 ? (
          <EmptyState message="아직 체중 기록이 없습니다. 첫 기록을 추가해보세요." />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-4">날짜</th>
                    <th className="pb-2 pr-4">체중</th>
                    <th className="pb-2 pr-4">걸음수</th>
                    <th className="pb-2 pr-4">수분</th>
                    <th className="pb-2 pr-4">수면</th>
                    <th className="pb-2">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const change = dayChanges.get(r.date) ?? null;
                    const changeClassName = getWeightChangeClassName(change);

                    return (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4">{formatDisplayDate(r.date)}</td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-medium ${changeClassName}`}
                          >
                            {r.weight.toFixed(1)} kg
                            {change != null && (
                              <span className="text-xs font-normal opacity-80">
                                {formatWeightChange(change)}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-3 pr-4">{r.steps?.toLocaleString() ?? "-"}</td>
                        <td className="py-3 pr-4">{r.water != null ? `${r.water}L` : "-"}</td>
                        <td className="py-3 pr-4">{r.sleep != null ? `${r.sleep}h` : "-"}</td>
                        <td className="py-3">
                          <div className="flex gap-2">
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
                    );
                  })}
                </tbody>
              </table>
            </div>
            <MobileRecordList>
              {records.map((r) => {
                const change = dayChanges.get(r.date) ?? null;
                const changeClassName = getWeightChangeClassName(change);

                return (
                  <RecordCard
                    key={r.id}
                    title={formatDisplayDate(r.date)}
                    highlight={
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-base font-medium ${changeClassName}`}
                      >
                        {r.weight.toFixed(1)} kg
                        {change != null && (
                          <span className="text-sm font-normal opacity-80">
                            {formatWeightChange(change)}
                          </span>
                        )}
                      </span>
                    }
                    fields={[
                      { label: "걸음수", value: r.steps?.toLocaleString() ?? "-" },
                      { label: "수분", value: r.water != null ? `${r.water}L` : "-" },
                      { label: "수면", value: r.sleep != null ? `${r.sleep}h` : "-" },
                    ]}
                    actions={
                      <>
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
        title={editingId ? "체중 기록 수정" : "체중 기록 추가"}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="날짜"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
          <Input
            label="체중 (kg)"
            type="number"
            step="0.1"
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: e.target.value })}
            required
          />
          <Input
            label="걸음 수"
            type="number"
            value={form.steps}
            onChange={(e) => setForm({ ...form, steps: e.target.value })}
          />
          <Input
            label="수분 (L)"
            type="number"
            step="0.1"
            value={form.water}
            onChange={(e) => setForm({ ...form, water: e.target.value })}
          />
          <Input
            label="수면 (h)"
            type="number"
            step="0.5"
            value={form.sleep}
            onChange={(e) => setForm({ ...form, sleep: e.target.value })}
          />
          <Select
            label="컨디션"
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
            options={[{ value: "", label: "선택" }, ...CONDITION_OPTIONS]}
          />
          <Select
            label="배변"
            value={form.bowelMovement}
            onChange={(e) => setForm({ ...form, bowelMovement: e.target.value })}
            options={[{ value: "", label: "선택" }, ...BOWEL_OPTIONS]}
          />
          <Input
            label="메모"
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            className="sm:col-span-2"
          />
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={saving || !form.weight}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="기록 삭제"
        message="이 체중 기록을 삭제하시겠습니까?"
        loading={saving}
      />
    </>
  );
}
