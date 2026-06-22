"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type HistoryItem = {
  id: number;
  name: string;
  quantity: number;
  dirtyAmount: number;
  usedToday: number;
};

type HistoryResponse = {
  dayKey?: string;
  items?: HistoryItem[];
  totalDirty?: number;
  totalUsedToday?: number;
  error?: string;
};

export function HistoryPage() {
  const lowStockThreshold = 4;
  const [dayKey, setDayKey] = useState("");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchHistory = async () => {
      try {
        const response = await fetch("/api/history", { cache: "no-store" });
        const data: HistoryResponse = await response.json();

        if (!response.ok || !data.items || !data.dayKey) {
          throw new Error(data.error || "Impossibile caricare lo storico");
        }

        if (!isMounted) {
          return;
        }

        setDayKey(data.dayKey);
        setItems(data.items);
      } catch (err) {
        if (!isMounted) {
          return;
        }

        const message = err instanceof Error ? err.message : "Errore imprevisto";
        setError(message);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  const totals = useMemo(
    () =>
      items.reduce(
        (acc, item) => {
          acc.usedToday += item.usedToday;
          acc.dirtyAmount += item.dirtyAmount;
          return acc;
        },
        { usedToday: 0, dirtyAmount: 0 },
      ),
    [items],
  );

  const lowStockItems = useMemo(
    () => items.filter((item) => item.quantity <= lowStockThreshold),
    [items],
  );

  const whatsappMessage = useMemo(() => {
    const lines = [
      `Riepilogo lavanderia ${dayKey || "oggi"}`,
      "",
      "Sporco da ritirare:",
      ...items.map((item) => `- ${item.name}: ${item.dirtyAmount}`),
      "",
      `Totale sporco: ${totals.dirtyAmount}`,
      "",
      "Scorte basse:",
    ];

    if (lowStockItems.length === 0) {
      lines.push("- Nessun prodotto sotto soglia");
    } else {
      lines.push(
        ...lowStockItems.map(
          (item) => `- ${item.name}: rimaste ${item.quantity} (soglia ${lowStockThreshold})`,
        ),
      );
    }

    return lines.join("\n");
  }, [dayKey, items, lowStockItems, lowStockThreshold, totals.dirtyAmount]);

  const whatsappUrl = useMemo(
    () => `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`,
    [whatsappMessage],
  );

  const handlePickup = async () => {
    try {
      setIsPickingUp(true);
      setError(null);

      const response = await fetch("/api/history/pickup", {
        method: "POST",
      });

      const data = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Impossibile completare il ritiro");
      }

      setItems((currentItems) =>
        currentItems.map((item) => ({
          ...item,
          dirtyAmount: 0,
        })),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore imprevisto";
      setError(message);
    } finally {
      setIsPickingUp(false);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopyMessage("Messaggio copiato");
    } catch {
      setCopyMessage("Copia non riuscita");
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6 pb-28 sm:px-6">
      <section className="rounded-[28px] bg-white/90 p-5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.3)] ring-1 ring-slate-200 backdrop-blur">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-2xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Torna al contatore
          </Link>
          <p className="mt-5 text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
            Storico
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Sporco di oggi</h1>
          <p className="mt-2 text-base leading-6 text-slate-600">
            Ogni rimozione viene conteggiata come biancheria sporca.
          </p>
          {dayKey ? (
            <p className="mt-2 text-sm text-slate-500">Data registro: {dayKey}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <article className="rounded-3xl bg-slate-900 p-4 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Usato oggi</p>
            <p className="mt-2 text-3xl font-bold">{loading ? "-" : totals.usedToday}</p>
          </article>
          <article className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="text-xs uppercase tracking-[0.2em] text-amber-700">Sporco attuale</p>
            <p className="mt-2 text-3xl font-bold">{loading ? "-" : totals.dirtyAmount}</p>
          </article>
        </div>

        <section className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-700">
                Messaggio WhatsApp
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                Lo prepari manualmente e lo incolli oppure lo apri direttamente su WhatsApp.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex min-h-12 items-center justify-center rounded-2xl border border-emerald-300 bg-white px-4 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onClick={() => void handleCopyMessage()}
              disabled={loading}
            >
              Copia messaggio
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              Apri WhatsApp
            </a>
          </div>

          {copyMessage ? <p className="mt-3 text-sm text-emerald-800">{copyMessage}</p> : null}
        </section>

        <section className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-rose-700">
            Avvisi Scorte
          </p>
          <p className="mt-2 text-sm leading-6 text-rose-900">
            Ti avviso quando un prodotto scende a {lowStockThreshold} o meno.
          </p>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="h-12 animate-pulse rounded-2xl bg-rose-100" />
            ) : lowStockItems.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800">
                Nessuna scorta critica al momento.
              </div>
            ) : (
              lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-rose-200 bg-white px-4 py-3"
                >
                  <p className="text-sm font-semibold text-rose-900">Ordina {item.name}</p>
                  <p className="mt-1 text-sm text-rose-700">
                    Rimaste {item.quantity} unita, soglia avviso {lowStockThreshold}.
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="animate-pulse rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="h-5 w-28 rounded bg-slate-200" />
                  <div className="mt-4 h-12 rounded-2xl bg-slate-200" />
                </div>
              ))
            : items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900">{item.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">Movimenti registrati oggi</p>
                    </div>
                    <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm ring-1 ring-slate-200">
                      <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Oggi</p>
                      <p className="text-2xl font-bold text-slate-900">{item.usedToday}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm text-amber-800">Sporco in attesa di ritiro</p>
                      <p className="mt-1 text-3xl font-bold text-amber-950">{item.dirtyAmount}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-sm text-slate-500">Scorte attuali</p>
                      <p className="mt-1 text-3xl font-bold text-slate-900">{item.quantity}</p>
                    </div>
                  </div>
                </article>
              ))}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-md px-4 pb-4 sm:px-6">
        <button
          type="button"
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-amber-500 px-5 text-base font-semibold text-slate-950 shadow-[0_16px_40px_-20px_rgba(245,158,11,0.75)] transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => void handlePickup()}
          disabled={isPickingUp || loading || totals.dirtyAmount === 0}
        >
          {isPickingUp ? "Ritiro in corso..." : "Ritiro"}
        </button>
      </div>
    </main>
  );
}
