"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

export function LaundryCounterApp() {
  const lowStockThreshold = 4;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<number[]>([]);

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

  const totalItems = useMemo(
    () => products.reduce((sum, product) => sum + product.quantity, 0),
    [products],
  );

  const lowStockItems = useMemo(
    () => products.filter((product) => product.quantity <= lowStockThreshold),
    [products],
  );

  const updateQuantity = async (productId: number, action: "increment" | "decrement") => {
    const previousProducts = products;

    setError(null);
    setBusyIds((current) => [...current, productId]);
    setProducts((currentProducts) =>
      currentProducts.map((product) => {
        if (product.id !== productId) {
          return product;
        }

        const nextQuantity =
          action === "increment"
            ? product.quantity + 1
            : Math.max(0, product.quantity - 1);

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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore imprevisto";
      setProducts(previousProducts);
      setError(message);
    } finally {
      setBusyIds((current) => current.filter((id) => id !== productId));
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

                return (
                  <article
                    key={product.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900">{product.name}</h2>
                        <p className="mt-1 text-sm text-slate-500">Pezzi disponibili</p>
                      </div>
                      <div className="min-w-20 rounded-2xl bg-white px-4 py-3 text-center shadow-sm ring-1 ring-slate-200">
                        <span className="text-3xl font-bold text-slate-900">{product.quantity}</span>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        aria-label={`Diminuisci ${product.name}`}
                        className="flex min-h-14 items-center justify-center rounded-2xl border border-slate-300 bg-white text-3xl font-semibold text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => updateQuantity(product.id, "decrement")}
                        disabled={isBusy || product.quantity === 0}
                      >
                        -
                      </button>
                      <button
                        type="button"
                        aria-label={`Aumenta ${product.name}`}
                        className="flex min-h-14 items-center justify-center rounded-2xl bg-blue-600 text-3xl font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={() => updateQuantity(product.id, "increment")}
                        disabled={isBusy}
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
