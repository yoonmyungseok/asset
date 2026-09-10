import { prisma } from "@/lib/db";

export async function getAccountTypeId(code: string): Promise<number> {
  const accountType = await prisma.accountType.findUnique({ where: { code } });
  if (!accountType) {
    throw new Error(`Account type not found: ${code}`);
  }
  return accountType.id;
}

export async function getPaymentMethodId(name: string): Promise<number> {
  const method = await prisma.paymentMethod.findUnique({ where: { name } });
  if (!method) {
    throw new Error(`Payment method not found: ${name}`);
  }
  return method.id;
}

export async function getCategoryId(name: string, parentName?: string): Promise<number> {
  if (parentName) {
    const parent = await prisma.category.findFirst({
      where: { name: parentName, parent_id: null },
    });
    if (!parent) {
      throw new Error(`Category parent not found: ${parentName}`);
    }
    const category = await prisma.category.findFirst({
      where: { name, parent_id: parent.id },
    });
    if (!category) {
      throw new Error(`Category not found: ${name} (parent: ${parentName})`);
    }
    return category.id;
  }

  const category = await prisma.category.findFirst({
    where: { name, parent_id: null },
  });
  if (!category) {
    throw new Error(`Category not found: ${name}`);
  }
  return category.id;
}
