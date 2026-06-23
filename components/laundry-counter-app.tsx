"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type Product = {
  id: number;
  name: string;
  quantity: number;
};

type ApiResponse = {
  products?: Product[];
  product?: Product;
  error?: string;
};

type RecentChange = {
  action: "increment" | "decrement";
  previousQuantity: number;
  nextQuantity: number;
};

type UndoToast = {
  productId: number;
  productName: string;
  previousQuantity: number;
  nextQuantity: number;
  reverseAction: "increment" | "decrement";
};

export function LaundryCounterApp() {
  const lowStockThreshold = 6;
  const tapCooldownMs = 450;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<number[]>([]);
  const [cooldownIds, setCooldownIds] = useState<number[]>([]);
  const [recentChanges, setRecentChanges] = useState<Record<number, RecentChange>>({});
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const cooldownTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const cooldownLocksRef = useRef<Record<number, boolean>>({});
  const changeTimeoutsRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/products", { cache: "no-store" });
        const data: ApiResponse = await response.json();

        if (!response.ok || !data.products) {
          throw new Error(data.error || "Impossibile caricare i prodotti");
        }

        setProducts(data.products);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Errore imprevisto";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadProducts();
  }, []);

  useEffect(() => {
    const cooldownTimeouts = cooldownTimeoutsRef.current;
    const changeTimeouts = changeTimeoutsRef.current;

    return () => {
      Object.values(cooldownTimeouts).forEach((timeout) => clearTimeout(timeout));
      Object.values(changeTimeouts).forEach((timeout) => clearTimeout(timeout));

      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const totalItems = useMemo(
    () => products.reduce((sum, product) => sum + product.quantity, 0),
    [products],
  );

  const lowStockItems = useMemo(
    () => products.filter((product) => product.quantity < lowStockThreshold),
    [products],
  );

  const registerRecentChange = (
    productId: number,
    action: "increment" | "decrement",
    previousQuantity: number,
    nextQuantity: number,
  ) => {
    setRecentChanges((current) => ({
      ...current,
      [productId]: { action, previousQuantity, nextQuantity },
    }));

    const currentTimeout = changeTimeoutsRef.current[productId];
    if (currentTimeout) {
      clearTimeout(currentTimeout);
    }

    changeTimeoutsRef.current[productId] = setTimeout(() => {
      setRecentChanges((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      delete changeTimeoutsRef.current[productId];
    }, 3500);
  };

  const showUndoToast = (toast: UndoToast) => {
    setUndoToast(toast);

    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    undoTimeoutRef.current = setTimeout(() => {
      setUndoToast(null);
      undoTimeoutRef.current = null;
    }, 5000);
  };

  const startCooldown = (productId: number) => {
    setCooldownIds((current) => [...current, productId]);

    const currentTimeout = cooldownTimeoutsRef.current[productId];
    if (currentTimeout) {
      clearTimeout(currentTimeout);
    }

    cooldownTimeoutsRef.current[productId] = setTimeout(() => {
      setCooldownIds((current) => current.filter((id) => id !== productId));
      delete cooldownLocksRef.current[productId];
      delete cooldownTimeoutsRef.current[productId];
    }, tapCooldownMs);
  };

  const updateQuantity = async (
    productId: number,
    action: "increment" | "decrement",
    options?: { showUndo?: boolean },
  ) => {
    const previousProducts = products;
    const targetProduct = products.find((product) => product.id === productId);

    if (!targetProduct) {
      return;
    }

    if (cooldownLocksRef.current[productId]) {
      return;
    }
    cooldownLocksRef.current[productId] = true;

    const previousQuantity = targetProduct.quantity;
    const nextQuantity =
      action === "increment"
        ? previousQuantity + 1
        : Math.max(0, previousQuantity - 1);

    if (previousQuantity === nextQuantity) {
      return;
    }

    setError(null);
    setBusyIds((current) => [...current, productId]);
    startCooldown(productId);
    registerRecentChange(productId, action, previousQuantity, nextQuantity);
    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        if (product.id !== productId) {
          return product;
        }

        return { ...product, quantity: nextQuantity };
      }),
    );

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data: ApiResponse = await response.json();

      if (!response.ok || !data.product) {
        throw new Error(data.error || "Impossibile aggiornare il prodotto");
      }

      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === data.product?.id ? data.product : product,
        ),
      );

      if (options?.showUndo !== false) {
        showUndoToast({
          productId,
          productName: targetProduct.name,
          previousQuantity,
          nextQuantity: data.product.quantity,
          reverseAction: action === "increment" ? "decrement" : "increment",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore imprevisto";
      setProducts(previousProducts);
      setRecentChanges((current) => {
        const next = { ...current };
        delete next[productId];
        return next;
      });
      setError(message);
    } finally {
      setBusyIds((current) => current.filter((id) => id !== productId));
    }
  };

  const handleUndo = async () => {
    if (!undoToast) {
      return;
    }

    setUndoBusy(true);
    setError(null);

    try {
      await updateQuantity(undoToast.productId, undoToast.reverseAction, { showUndo: false });
      setUndoToast(null);
    } finally {
      setUndoBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6 pb-28 sm:px-6">
      <section className="rounded-[28px] bg-white/90 p-5 shadow-[0_20px_60px_-30px_rgba(37,99,235,0.45)] ring-1 ring-slate-200 backdrop-blur">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">Lavanderia</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Contatore biancheria</h1>
            <p className="mt-2 text-base leading-6 text-slate-600">
              Aggiorna rapidamente le quantita di ogni prodotto.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-right text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Totale</p>
            <p className="text-2xl font-bold">{totalItems}</p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!loading && lowStockItems.length > 0 ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            Scorte basse: {lowStockItems.map((product) => product.name).join(", ")}.
          </div>
        ) : null}

        <div className="space-y-4">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="h-5 w-28 rounded bg-slate-200" />
                  <div className="mt-4 h-12 rounded-2xl bg-slate-200" />
                </div>
              ))
            : products.map((product) => {
                const isBusy = busyIds.includes(product.id);
                const isCoolingDown = cooldownIds.includes(product.id);
                const recentChange = recentChanges[product.id];
                const cardTone = recentChange
                  ? recentChange.action === "increment"
                    ? "border-emerald-300 bg-emerald-50/80"
                    : "border-amber-300 bg-amber-50/90"
                  : "border-slate-200 bg-slate-50";

                return (
                  <article
                    key={product.id}
                    className={`rounded-3xl border p-5 shadow-sm transition-colors duration-200 ${cardTone}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900">{product.name}</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          {recentChange
                            ? `${recentChange.previousQuantity} -> ${recentChange.nextQuantity}`
                            : "Pezzi disponibili"}
                        </p>
                      </div>
                      <div className="min-w-20 rounded-2xl bg-white px-4 py-3 text-center shadow-sm ring-1 ring-slate-200">
                        <span className="text-3xl font-bold text-slate-900">{product.quantity}</span>
                      </div>
                    </div>

                    {recentChange ? (
                      <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2 text-sm">
                        <span
                          className={`font-medium ${
                            recentChange.action === "increment" ? "text-emerald-700" : "text-amber-700"
                          }`}
                        >
                          {recentChange.action === "increment" ? "Aggiunto 1 pezzo" : "Rimosso 1 pezzo"}
                        </span>
                        <span className="text-slate-500">
                          {recentChange.previousQuantity} {"->"} {recentChange.nextQuantity}
                        </span>
                      </div>
                    ) : null}

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        aria-label={`Diminuisci ${product.name}`}
                        className="flex min-h-14 items-center justify-center rounded-2xl border border-slate-300 bg-white text-3xl font-semibold text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void updateQuantity(product.id, "decrement")}
                        disabled={isBusy || isCoolingDown || product.quantity === 0}
                      >
                        -
                      </button>
                      <button
                        type="button"
                        aria-label={`Aumenta ${product.name}`}
                        className="flex min-h-14 items-center justify-center rounded-2xl bg-blue-600 text-3xl font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => void updateQuantity(product.id, "increment")}
                        disabled={isBusy || isCoolingDown}
                      >
                        +
                      </button>
                    </div>
                  </article>
                );
              })}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md px-4 pb-4 sm:px-6">
        {undoToast ? (
          <div className="mb-3 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-200 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{undoToast.productName}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {undoToast.previousQuantity} {"->"} {undoToast.nextQuantity}
                </p>
              </div>
              <button
                type="button"
                className="min-h-11 rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void handleUndo()}
                disabled={undoBusy}
              >
                {undoBusy ? "Attendi..." : "Annulla"}
              </button>
            </div>
          </div>
        ) : null}
        <Link
          href="/storico"
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-slate-900 px-5 text-base font-semibold text-white shadow-[0_16px_40px_-20px_rgba(15,23,42,0.8)] transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
        >
          {lowStockItems.length > 0
            ? `Apri storico e avvisi (${lowStockItems.length})`
            : "Apri storico sporco"}
        </Link>
      </div>
    </main>
  );
}
