import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { refreshPrices, updateHolding } from "@/lib/services/holdings";
import { holdingCurrentPrice } from "@/lib/utils";
import { apiClient } from "../helpers/api-client";
import { getAccountTypeId, getPaymentMethodId } from "../helpers/seed-ids";

describe("암호화폐 거래소 자산", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("소수점 매매와 수수료, 전량 매도 취소를 원가까지 복원한다", async () => {
    const type = await getAccountTypeId("CRYPTO_EXCHANGE");
    const accountResponse = await apiClient.post("/api/v1/accounts", { json: { account_type_id: type, name: "거래소", institution: "빗썸", cash_balance: 100000 } });
    expect(accountResponse.status).toBe(201);
    const { id } = await accountResponse.json<{ id: number }>();
    const trade = async (data: object) => apiClient.post("/api/v1/investment-transactions", { json: { account_id: id, transaction_date: "2026-01-01", ...data } });
    const buy = await trade({ type: "buy", symbol: "BTC", name: "비트코인", quantity: "0.01", price: "1000000", amount: "10000", fee: "10.25" });
    expect(buy.status).toBe(201);
    const buyData = await buy.json<{ id: number; holding_id: number }>();
    const second = await trade({ type: "buy", symbol: "BTC", name: "비트코인", quantity: "0.01", price: "2000000", amount: "20000", fee: "20.15" });
    expect(second.status).toBe(201);
    const secondData = await second.json<{ id: number }>();
    const blocked = await apiClient.delete(`/api/v1/investment-transactions/${buyData.id}`);
    expect(blocked.status).toBe(400);
    const partial = await trade({ type: "sell", holding_id: buyData.holding_id, quantity: "0.005", price: "2000000", amount: "10000", fee: "5" });
    expect(partial.status).toBe(201);
    const partialId = (await partial.json<{ id: number }>()).id;
    const remaining = await (await apiClient.get(`/api/v1/holdings?account_id=${id}`)).json<Array<{ quantity: string; cost_basis: string }>>();
    expect(Number(remaining[0].quantity)).toBe(0.015);
    expect(Number(remaining[0].cost_basis)).toBe(22522.8);
    expect((await apiClient.delete(`/api/v1/investment-transactions/${partialId}`)).status).toBe(204);
    const sale = await trade({ type: "sell", holding_id: buyData.holding_id, quantity: "0.02", price: "2500000", amount: "50000", fee: "50" });
    expect(sale.status).toBe(201);
    const saleData = await sale.json<{ id: number }>();
    const holdings = async () => (await apiClient.get(`/api/v1/holdings?account_id=${id}`)).json<Array<{ quantity: string; cost_basis: string; asset_class: string }>>();
    // 보유 목록은 수량이 0인 종목을 표시하지 않는다.
    expect(await holdings()).toHaveLength(0);
    expect((await apiClient.delete(`/api/v1/investment-transactions/${saleData.id}`)).status).toBe(204);
    const restored = (await holdings())[0];
    expect(restored.asset_class).toBe("crypto");
    expect(Number(restored.quantity)).toBe(0.02);
    expect(Number(restored.cost_basis)).toBe(30030.4);
    const changed = await apiClient.patch(`/api/v1/investment-transactions/${secondData.id}`, { json: { amount: "21000", fee: "21.25" } });
    expect(changed.status).toBe(200);
    expect(Number((await holdings())[0].cost_basis)).toBe(31031.5);
    expect((await apiClient.delete(`/api/v1/investment-transactions/${secondData.id}`)).status).toBe(204);
    expect(Number((await holdings())[0].cost_basis)).toBe(10010.25);
    const account = await (await apiClient.get(`/api/v1/accounts/${id}`)).json<{ cash_balance: string }>();
    expect(Number(account.cash_balance)).toBe(89989.75);
  });

  it("거래소 선택 오류와 보유량 초과 매도를 거부한다", async () => {
    const type = await getAccountTypeId("CRYPTO_EXCHANGE");
    const invalid = await apiClient.post("/api/v1/accounts", { json: { account_type_id: type, name: "거래소", institution: "기타" } });
    expect(invalid.status).toBe(400);
    const created = await apiClient.post("/api/v1/accounts", { json: { account_type_id: type, name: "거래소", institution: "업비트", cash_balance: 10000 } });
    const { id } = await created.json<{ id: number }>();
    const sale = await apiClient.post("/api/v1/investment-transactions", { json: { account_id: id, type: "sell", transaction_date: "2026-01-01", symbol: "BTC", name: "비트코인", quantity: 1, price: 1, amount: 1 } });
    expect(sale.status).toBe(400);
  });

  it("은행에서 거래소로 이체하면 잔액만 이동하고 소비로 집계되지 않는다", async () => {
    const bankType = await getAccountTypeId("CHECKING");
    const exchangeType = await getAccountTypeId("CRYPTO_EXCHANGE");
    const bank = await apiClient.post("/api/v1/accounts", { json: { account_type_id: bankType, name: "은행", cash_balance: 100000 } });
    const exchange = await apiClient.post("/api/v1/accounts", { json: { account_type_id: exchangeType, name: "빗썸", institution: "빗썸" } });
    const bankId = (await bank.json<{ id: number }>()).id;
    const exchangeId = (await exchange.json<{ id: number }>()).id;
    const transfer = await apiClient.post("/api/v1/ledger-transactions", { json: { type: "transfer", transaction_date: "2026-01-01", amount: 40000, account_id: bankId, to_account_id: exchangeId, payment_method_id: await getPaymentMethodId("계좌이체") } });
    expect(transfer.status).toBe(201);
    const bankAccount = await (await apiClient.get(`/api/v1/accounts/${bankId}`)).json<{ cash_balance: string }>();
    const exchangeAccount = await (await apiClient.get(`/api/v1/accounts/${exchangeId}`)).json<{ cash_balance: string }>();
    expect(Number(bankAccount.cash_balance)).toBe(60000);
    expect(Number(exchangeAccount.cash_balance)).toBe(40000);
    const summary = await (await apiClient.get("/api/v1/ledger-transactions/summary?year=2026&month=1")).json<{ total_expense: string }>();
    expect(Number(summary.total_expense)).toBe(0);
  });

  it("시세 조회 실패 시 이전 가격을 보존하고 수동 가격을 우선한다", async () => {
    const account = await prisma.account.create({ data: { account_type_id: await getAccountTypeId("CRYPTO_EXCHANGE"), name: "업비트", institution: "업비트" } });
    const holding = await prisma.holding.create({ data: { account_id: account.id, asset_class: "crypto", symbol: "BTC", name: "비트코인", quantity: "0.01", avg_cost_price: 100, last_market_price: 200 } });
    // 외부 장애를 재현하고 마지막 정상 시세가 유지되는지 확인한다.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("연결 실패")));
    const result = await refreshPrices([holding.id]);
    expect(result.failed).toHaveLength(1);
    expect(Number((await prisma.holding.findUniqueOrThrow({ where: { id: holding.id } })).last_market_price)).toBe(200);
    const updated = await updateHolding(holding.id, { manual_price: 150 });
    expect(holdingCurrentPrice(updated).toNumber()).toBe(150);
    const automatic = await updateHolding(holding.id, { manual_price: null });
    expect(holdingCurrentPrice(automatic).toNumber()).toBe(200);
  });
});
