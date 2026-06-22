import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const products = [
  { name: "LENZUOLA", quantity: 17 },
  { name: "FEDERE", quantity: 14 },
  { name: "TAPPETINI", quantity: 11 },
  { name: "VISO", quantity: 12 },
  { name: "TELI", quantity: 11 },
];

async function main() {
  for (const product of products) {
    await prisma.product.upsert({
      where: { name: product.name },
      update: { quantity: product.quantity },
      create: product,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
