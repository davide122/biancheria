import { NextRequest, NextResponse } from "next/server";
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

    let product;

    if (body.action === "increment") {
      product = await prisma.product.update({
        where: { id: productId },
        data: {
          quantity: {
            increment: 1,
          },
        },
      });
    } else {
      await prisma.product.updateMany({
        where: {
          id: productId,
          quantity: {
            gt: 0,
          },
        },
        data: {
          quantity: {
            decrement: 1,
          },
        },
      });

      product = await prisma.product.findUnique({
        where: { id: productId },
      });
    }

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
