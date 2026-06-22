import { NextRequest, NextResponse } from "next/server";
import { getItalyDayInfo } from "@/lib/day";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Action = "increment" | "decrement";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const productId = Number(id);

    if (Number.isNaN(productId)) {
      return NextResponse.json({ error: "ID prodotto non valido" }, { status: 400 });
    }

    const body = (await request.json()) as { action?: Action };

    if (body.action !== "increment" && body.action !== "decrement") {
      return NextResponse.json({ error: "Azione non valida" }, { status: 400 });
    }

    const product = await prisma.$transaction(async (tx) => {
      const currentProduct = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!currentProduct) {
        return null;
      }

      if (body.action === "increment") {
        return tx.product.update({
          where: { id: productId },
          data: {
            quantity: {
              increment: 1,
            },
          },
        });
      }

      if (currentProduct.quantity === 0) {
        return currentProduct;
      }

      const { dayKey, date } = getItalyDayInfo();

      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          quantity: {
            decrement: 1,
          },
          dirtyAmount: {
            increment: 1,
          },
        },
      });

      await tx.dailyUsage.upsert({
        where: {
          productId_dayKey: {
            productId,
            dayKey,
          },
        },
        update: {
          removedAmount: {
            increment: 1,
          },
        },
        create: {
          productId,
          dayKey,
          date,
          removedAmount: 1,
        },
      });

      return updatedProduct;
    });

    if (!product) {
      return NextResponse.json({ error: "Prodotto non trovato" }, { status: 404 });
    }

    return NextResponse.json({ product });
  } catch (error) {
    console.error("PATCH /api/products/[id] failed", error);

    return NextResponse.json(
      { error: "Impossibile aggiornare il prodotto" },
      { status: 500 },
    );
  }
}
