import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

    const body = (await request.json()) as { dirtyAmount?: number };

    if (
      typeof body.dirtyAmount !== "number" ||
      !Number.isInteger(body.dirtyAmount) ||
      body.dirtyAmount < 0
    ) {
      return NextResponse.json(
        { error: "Lo sporco deve essere un numero intero maggiore o uguale a 0" },
        { status: 400 },
      );
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        dirtyAmount: body.dirtyAmount,
      },
    });

    return NextResponse.json({ product });
  } catch (error) {
    console.error("PATCH /api/products/[id]/dirty failed", error);

    return NextResponse.json(
      { error: "Impossibile aggiornare lo sporco del prodotto" },
      { status: 500 },
    );
  }
}
