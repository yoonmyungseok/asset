import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ACCOUNT_TYPE_SEEDS = [
  { code: "ISA", name: "ISA", category: "investment", supports_holdings: true, supports_contribution_limit: true, sort_order: 1 },
  { code: "IRP", name: "IRP", category: "pension", supports_holdings: true, supports_contribution_limit: true, sort_order: 2 },
  { code: "PENSION_SAVINGS", name: "연금저축", category: "pension", supports_holdings: true, supports_contribution_limit: true, sort_order: 3 },
  { code: "DC_PENSION", name: "DC퇴직연금", category: "pension", supports_holdings: true, supports_contribution_limit: false, sort_order: 4 },
  { code: "BROKERAGE", name: "일반증권", category: "investment", supports_holdings: true, supports_contribution_limit: false, sort_order: 5 },
  { code: "SAVINGS", name: "적금", category: "deposit", supports_holdings: false, supports_contribution_limit: false, sort_order: 6 },
  { code: "DEPOSIT", name: "예금", category: "deposit", supports_holdings: false, supports_contribution_limit: false, sort_order: 7 },
  { code: "CHECKING", name: "입출금", category: "cash", supports_holdings: false, supports_contribution_limit: false, sort_order: 8 },
] as const;

const PAYMENT_METHOD_SEEDS = ["현금", "카드", "계좌이체"] as const;

const CATEGORY_SEEDS = [
  { type: "expense", name: "식비", children: ["외식", "장보기", "카페"] },
  { type: "expense", name: "교통", children: ["대중교통", "주유", "택시"] },
  { type: "expense", name: "주거", children: ["월세", "관리비", "공과금"] },
  { type: "expense", name: "생활", children: ["통신비", "의료", "쇼핑", "카드대금"] },
  { type: "expense", name: "문화", children: ["여가", "구독"] },
  { type: "income", name: "급여", children: ["본봉", "상여"] },
  { type: "income", name: "기타수입", children: ["이자", "배당", "기타"] },
] as const;

export async function runSeed(client: PrismaClient = prisma) {
  for (const seed of ACCOUNT_TYPE_SEEDS) {
    await client.accountType.upsert({
      where: { code: seed.code },
      update: {
        name: seed.name,
        category: seed.category,
        supports_holdings: seed.supports_holdings,
        supports_contribution_limit: seed.supports_contribution_limit,
        sort_order: seed.sort_order,
        is_system: true,
      },
      create: {
        ...seed,
        is_system: true,
      },
    });
  }

  for (const name of PAYMENT_METHOD_SEEDS) {
    await client.paymentMethod.upsert({
      where: { name },
      update: { is_system: true },
      create: { name, is_system: true },
    });
  }

  let parentSort = 0;
  for (const { type, name, children } of CATEGORY_SEEDS) {
    let parent = await client.category.findFirst({
      where: { name, parent_id: null },
    });
    if (!parent) {
      parent = await client.category.create({
        data: {
          name,
          type,
          parent_id: null,
          is_system: true,
          sort_order: parentSort,
          is_active: true,
        },
      });
    } else {
      parent = await client.category.update({
        where: { id: parent.id },
        data: { type, is_system: true, is_active: true },
      });
    }

    parentSort += 1;

    for (const [idx, childName] of children.entries()) {
      const existing = await client.category.findFirst({
        where: { name: childName, parent_id: parent.id },
      });
      if (existing) {
        await client.category.update({
          where: { id: existing.id },
          data: { type, is_system: true, sort_order: idx, is_active: true },
        });
        continue;
      }
      await client.category.create({
        data: {
          name: childName,
          type,
          parent_id: parent.id,
          is_system: true,
          sort_order: idx,
          is_active: true,
        },
      });
    }
  }
}

async function main() {
  await runSeed();

  const [accountTypes, categories, paymentMethods] = await Promise.all([
    prisma.accountType.count(),
    prisma.category.count(),
    prisma.paymentMethod.count(),
  ]);

  console.log(`Seeded: account_types=${accountTypes}, categories=${categories}, payment_methods=${paymentMethods}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
