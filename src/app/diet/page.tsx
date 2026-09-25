"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/care/ui/Card";
import { Button } from "@/components/care/ui/Button";
import { Input } from "@/components/care/ui/Input";
import { Select } from "@/components/care/ui/Select";
import { StatCard } from "@/components/care/ui/StatCard";
import { ProgressBar } from "@/components/care/ui/ProgressBar";
import { Modal, ConfirmDialog } from "@/components/care/ui/Modal";
import { LoadingSpinner, EmptyState } from "@/components/care/ui/Loading";
import { RecordCard, MobileRecordList } from "@/components/care/ui/RecordCard";
import { useToast } from "@/components/care/ui/Toast";
import { MEAL_TYPES } from "@/lib/care/constants";
import { todayString } from "@/lib/care/utils";
import {
  scaleNutrition,
  formatConsumptionDisplay,
  deriveQuantityFromEntry,
} from "@/lib/care/calculations/diet";

interface FoodEntry {
  id: number;
  foodName: string;
  amount: number;
  unit: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  sodium: number | null;
  memo: string | null;
}

interface Meal {
  id: number;
  date: string;
  mealType: string;
  foodEntries: FoodEntry[];
}

interface FoodItem {
  id: number;
  name: string;
  standardAmount: string;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  sodium: number | null;
}

interface NutritionSummary {
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  remainingCalories: number;
}

interface Targets {
  targetCalories: number;
  targetCarbs: number;
  targetProtein: number;
  targetFat: number;
}

const emptyForm = {
  mealType: "breakfast",
  foodName: "",
  amount: "",
  unit: "g",
  calories: "",
  carbs: "",
  protein: "",
  fat: "",
  sodium: "",
  memo: "",
};

function findFoodItem(foodItems: FoodItem[], foodName: string) {
  return foodItems.find((f) => f.name === foodName);
}

function applyScaledNutrition(
  item: FoodItem,
  quantity: number,
  form: typeof emptyForm,
): typeof emptyForm {
  const scaled = scaleNutrition(item, quantity, 1);
  return {
    ...form,
    amount: quantity > 0 ? quantity.toString() : "",
    unit: item.standardAmount,
    calories: scaled.calories.toFixed(1),
    carbs: scaled.carbs.toFixed(1),
    protein: scaled.protein.toFixed(1),
    fat: scaled.fat.toFixed(1),
    sodium: scaled.sodium > 0 ? scaled.sodium.toFixed(1) : "",
  };
}

function getEntryDisplayAmount(
  entry: FoodEntry,
  foodItems: FoodItem[],
): string {
  const item = findFoodItem(foodItems, entry.foodName);
  if (item) {
    const quantity =
      entry.unit === item.standardAmount
        ? entry.amount
        : deriveQuantityFromEntry(entry, item);
    return formatConsumptionDisplay(quantity, item.standardAmount);
  }
  return `${entry.amount} ${entry.unit}`;
}

export default function DietPage() {
  const { showToast } = useToast();
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [summary, setSummary] = useState<NutritionSummary | null>(null);
  const [targets, setTargets] = useState<Targets | null>(null);
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedFoodItemId, setSelectedFoodItemId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedFoodItem = selectedFoodItemId
    ? foodItems.find((f) => f.id === selectedFoodItemId) ?? null
    : null;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dietRes, foodRes] = await Promise.all([
        fetch(`/api/diet?date=${selectedDate}`),
        fetch("/api/diet/food-items"),
      ]);

      if (!dietRes.ok || !foodRes.ok) {
        const failedRes = !dietRes.ok ? dietRes : foodRes;
        const body = await failedRes.json().catch(() => ({}));
        showToast(
          (body as { error?: string }).error ?? "식단 데이터를 불러오지 못했습니다",
          "error",
        );
        return;
      }

      const dietData = await dietRes.json();
      const foodData = await foodRes.json();
      setMeals(dietData.meals);
      setSummary(dietData.summary);
      setTargets(dietData.targets);
      setFoodItems(foodData);
    } catch {
      showToast("네트워크 오류로 데이터를 불러오지 못했습니다", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = (mealType?: string) => {
    setEditingId(null);
    setForm({ ...emptyForm, mealType: mealType ?? "breakfast" });
    setSelectedFoodItemId(null);
    setModalOpen(true);
  };

  const openEdit = (entry: FoodEntry, mealType: string) => {
    setEditingId(entry.id);
    const item = findFoodItem(foodItems, entry.foodName);

    if (item) {
      const quantity =
        entry.unit === item.standardAmount
          ? entry.amount
          : deriveQuantityFromEntry(entry, item);

      setSelectedFoodItemId(item.id);
      setForm({
        mealType,
        foodName: entry.foodName,
        amount: quantity.toString(),
        unit: item.standardAmount,
        calories: entry.calories.toString(),
        carbs: entry.carbs.toString(),
        protein: entry.protein.toString(),
        fat: entry.fat.toString(),
        sodium: entry.sodium?.toString() ?? "",
        memo: entry.memo ?? "",
      });
    } else {
      setSelectedFoodItemId(null);
      setForm({
        mealType,
        foodName: entry.foodName,
        amount: entry.amount.toString(),
        unit: entry.unit,
        calories: entry.calories.toString(),
        carbs: entry.carbs.toString(),
        protein: entry.protein.toString(),
        fat: entry.fat.toString(),
        sodium: entry.sodium?.toString() ?? "",
        memo: entry.memo ?? "",
      });
    }
    setModalOpen(true);
  };

  const handleFoodItemSelect = (itemId: string) => {
    if (!itemId) {
      setSelectedFoodItemId(null);
      return;
    }

    const item = foodItems.find((f) => f.id === parseInt(itemId, 10));
    if (!item) return;

    setSelectedFoodItemId(item.id);
    setForm(applyScaledNutrition(item, 1, { ...form, foodName: item.name }));
  };

  const handleQuantityChange = (quantityStr: string) => {
    if (selectedFoodItem) {
      const quantity = parseFloat(quantityStr);
      if (!quantityStr || Number.isNaN(quantity) || quantity <= 0) {
        setForm({ ...form, amount: quantityStr });
        return;
      }
      setForm(applyScaledNutrition(selectedFoodItem, quantity, form));
      return;
    }
    setForm({ ...form, amount: quantityStr });
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      date: selectedDate,
      mealType: form.mealType,
      foodName: form.foodName,
      amount: parseFloat(form.amount),
      unit: form.unit,
      calories: parseFloat(form.calories),
      carbs: parseFloat(form.carbs),
      protein: parseFloat(form.protein),
      fat: parseFloat(form.fat),
      sodium: form.sodium ? parseFloat(form.sodium) : null,
      memo: form.memo || null,
    };

    const url = editingId ? `/api/diet/entries/${editingId}` : "/api/diet/entries";
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
    const res = await fetch(`/api/diet/entries/${deleteId}`, { method: "DELETE" });
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

  if (loading && !summary) {
    return (
      <LoadingSpinner />
    );
  }

  return (
    <>
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">식단 관리</h1>
          <p className="text-sm text-slate-500">하루 식사와 영양소를 기록하세요</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full"
          />
          <Link href="/food-settings" className="w-full shrink-0 sm:w-auto">
            <Button type="button" variant="secondary" className="w-full">
              음식 DB
            </Button>
          </Link>
          <Button onClick={() => openCreate()} className="w-full shrink-0 sm:w-auto">
            + 기록 추가
          </Button>
        </div>
      </div>

      {summary && targets && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="섭취 칼로리"
              value={`${summary.calories.toFixed(0)} kcal`}
              subValue={`남은 ${summary.remainingCalories.toFixed(0)} kcal`}
            />
            <StatCard
              label="목표 칼로리"
              value={`${targets.targetCalories.toFixed(0)} kcal`}
            />
            <StatCard
              label="탄수화물"
              value={`${summary.carbs.toFixed(0)} g`}
            />
            <StatCard
              label="단백질 / 지방"
              value={`${summary.protein.toFixed(0)}g / ${summary.fat.toFixed(0)}g`}
            />
          </div>

          <Card title="영양소 현황" className="mb-6">
            <div className="space-y-4">
              <ProgressBar
                label="칼로리"
                current={summary.calories}
                target={targets.targetCalories}
                unit=" kcal"
                color="bg-orange-500"
              />
              <ProgressBar
                label="탄수화물"
                current={summary.carbs}
                target={targets.targetCarbs}
                color="bg-amber-500"
              />
              <ProgressBar
                label="단백질"
                current={summary.protein}
                target={targets.targetProtein}
                color="bg-emerald-500"
              />
              <ProgressBar
                label="지방"
                current={summary.fat}
                target={targets.targetFat}
                color="bg-rose-500"
              />
            </div>
          </Card>
        </>
      )}

      {MEAL_TYPES.map((mealType) => {
        const meal = meals.find((m) => m.mealType === mealType.value);
        const entries = meal?.foodEntries ?? [];

        return (
          <Card
            key={mealType.value}
            title={mealType.label}
            className="mb-4"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openCreate(mealType.value)}
                className="w-full sm:w-auto"
              >
                + 추가
              </Button>
            }
          >
            {entries.length === 0 ? (
              <EmptyState message={`${mealType.label} 기록이 없습니다`} />
            ) : (
              <>
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="pb-2 pr-4">음식</th>
                        <th className="pb-2 pr-4">섭취량</th>
                        <th className="pb-2 pr-4">칼로리</th>
                        <th className="pb-2 pr-4">탄/단/지</th>
                        <th className="pb-2">작업</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.id} className="border-b border-slate-100">
                          <td className="py-3 pr-4 font-medium">{entry.foodName}</td>
                          <td className="py-3 pr-4">
                            {getEntryDisplayAmount(entry, foodItems)}
                          </td>
                          <td className="py-3 pr-4">{entry.calories.toFixed(0)} kcal</td>
                          <td className="py-3 pr-4 text-slate-500">
                            {entry.carbs.toFixed(0)}/{entry.protein.toFixed(0)}/{entry.fat.toFixed(0)}g
                          </td>
                          <td className="py-3">
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(entry, mealType.value)}
                              >
                                수정
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setDeleteId(entry.id);
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
                  {entries.map((entry) => (
                    <RecordCard
                      key={entry.id}
                      title={entry.foodName}
                      highlight={
                        <span className="text-base font-medium text-slate-800">
                          {entry.calories.toFixed(0)} kcal
                        </span>
                      }
                      fields={[
                        {
                          label: "섭취량",
                          value: getEntryDisplayAmount(entry, foodItems),
                        },
                        {
                          label: "탄/단/지",
                          value: `${entry.carbs.toFixed(0)}/${entry.protein.toFixed(0)}/${entry.fat.toFixed(0)}g`,
                        },
                      ]}
                      actions={
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(entry, mealType.value)}
                          >
                            수정
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeleteId(entry.id);
                              setConfirmOpen(true);
                            }}
                          >
                            삭제
                          </Button>
                        </>
                      }
                    />
                  ))}
                </MobileRecordList>
              </>
            )}
          </Card>
        );
      })}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "음식 수정" : "음식 추가"}
        size="lg"
      >
        {foodItems.length > 0 && (
          <div className="mb-4">
            <Select
              label="음식 DB에서 선택"
              value={selectedFoodItemId?.toString() ?? ""}
              onChange={(e) => handleFoodItemSelect(e.target.value)}
              options={[
                { value: "", label: "직접 입력" },
                ...foodItems.map((f) => ({
                  value: f.id.toString(),
                  label: `${f.name} (${f.standardAmount})`,
                })),
              ]}
            />
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="식사 구분"
            value={form.mealType}
            onChange={(e) => setForm({ ...form, mealType: e.target.value })}
            options={[...MEAL_TYPES]}
          />
          <Input
            label="음식명"
            value={form.foodName}
            onChange={(e) => setForm({ ...form, foodName: e.target.value })}
            disabled={!!selectedFoodItem}
          />
          {selectedFoodItem ? (
            <>
              <div>
                <p className="mb-1 text-sm font-medium text-slate-700">기준량</p>
                <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {selectedFoodItem.standardAmount}
                </p>
              </div>
              <Input
                label="수량"
                type="number"
                step="0.1"
                min="0.1"
                value={form.amount}
                onChange={(e) => handleQuantityChange(e.target.value)}
                placeholder="예: 3"
              />
            </>
          ) : (
            <>
              <Input
                label="섭취량"
                type="number"
                step="0.1"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
              <Input
                label="단위"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              />
            </>
          )}
          {selectedFoodItem ? (
            <div className="sm:col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="mb-2 break-words text-sm font-medium text-emerald-800">
                {form.amount
                  ? formatConsumptionDisplay(
                      parseFloat(form.amount),
                      selectedFoodItem.standardAmount,
                    )
                  : `${selectedFoodItem.standardAmount} × ?`}
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-emerald-700 sm:flex sm:flex-wrap sm:gap-x-3">
                <span>칼로리 {form.calories || "0"} kcal</span>
                <span>탄 {form.carbs || "0"}g</span>
                <span>단 {form.protein || "0"}g</span>
                <span>지 {form.fat || "0"}g</span>
                {form.sodium ? <span className="col-span-2 sm:col-span-1">나트륨 {form.sodium}mg</span> : null}
              </div>
            </div>
          ) : (
            <>
              <Input
                label="칼로리 (kcal)"
                type="number"
                value={form.calories}
                onChange={(e) => setForm({ ...form, calories: e.target.value })}
              />
              <Input
                label="탄수화물 (g)"
                type="number"
                value={form.carbs}
                onChange={(e) => setForm({ ...form, carbs: e.target.value })}
              />
              <Input
                label="단백질 (g)"
                type="number"
                value={form.protein}
                onChange={(e) => setForm({ ...form, protein: e.target.value })}
              />
              <Input
                label="지방 (g)"
                type="number"
                value={form.fat}
                onChange={(e) => setForm({ ...form, fat: e.target.value })}
              />
              <Input
                label="나트륨 (mg)"
                type="number"
                value={form.sodium}
                onChange={(e) => setForm({ ...form, sodium: e.target.value })}
              />
            </>
          )}
          <div className="sm:col-span-2">
            <Input
              label="메모"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
            />
          </div>
        </div>
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
            disabled={saving || !form.foodName}
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
        title="음식 삭제"
        message="이 음식 기록을 삭제하시겠습니까?"
        loading={saving}
      />
    </>
  );
}
