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
  error?: string;
};

type DirtyUpdateResponse = {
  product?: {
    id: number;
    dirtyAmount: number;
  };
  error?: string;
};

const pairProductNames = ["LENZUOLA", "TAPPETINI", "FEDERE", "TELI", "BIDET", "VISO"] as const;
const reorderThreshold = 6;
const pairRequirements: Record<(typeof pairProductNames)[number], number> = {
  LENZUOLA: 2,
  TAPPETINI: 1,
  FEDERE: 2,
  TELI: 2,
  BIDET: 2,
  VISO: 2,
};

export function HistoryPage() {
  const [dayKey, setDayKey] = useState("");
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPickingUp, setIsPickingUp] = useState(false);
  const [editingDirtyId, setEditingDirtyId] = useState<number | null>(null);
  const [dirtyDraft, setDirtyDraft] = useState("");
  const [dirtyBusyId, setDirtyBusyId] = useState<number | null>(null);
  const [dirtyStatus, setDirtyStatus] = useState<string | null>(null);
  const [reportType, setReportType] = useState<"pickup" | "order">("pickup");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
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
          acc.dirtyAmount += item.dirtyAmount;
          acc.quantity += item.quantity;
          return acc;
        },
        { quantity: 0, dirtyAmount: 0 },
      ),
    [items],
  );

  const pairItems = useMemo(
    () =>
      items.filter((item) =>
        pairProductNames.includes(item.name as (typeof pairProductNames)[number]),
      ),
    [items],
  );

  const otherItems = useMemo(
    () => items.filter((item) => !pairItems.some((pairItem) => pairItem.id === item.id)),
    [items, pairItems],
  );

  const possiblePairs = useMemo(() => {
    if (pairItems.length === 0) {
      return 0;
    }

    return Math.min(
      ...pairItems.map((item) =>
        Math.floor(item.quantity / pairRequirements[item.name as keyof typeof pairRequirements]),
      ),
    );
  }, [pairItems]);

  const pairBreakdown = useMemo(
    () =>
      pairItems.map((item) => ({
        ...item,
        requirement: pairRequirements[item.name as keyof typeof pairRequirements],
        pairsFromCurrent: Math.floor(
          item.quantity / pairRequirements[item.name as keyof typeof pairRequirements],
        ),
        isLimiting:
          Math.floor(item.quantity / pairRequirements[item.name as keyof typeof pairRequirements]) ===
          possiblePairs,
      })),
    [pairItems, possiblePairs],
  );

  const reorderSuggestions = useMemo(() => {
    return pairItems
      .map((item) => ({
        ...item,
        missingQuantity: Math.max(0, reorderThreshold - item.quantity),
      }))
      .filter((item) => item.missingQuantity > 0)
      .sort((first, second) => second.missingQuantity - first.missingQuantity);
  }, [pairItems]);

  const pickupMessage = useMemo(() => {
    const dirtyItems = items.filter((item) => item.dirtyAmount > 0);
    const lines = [`Ritiro sporco ${dayKey || "oggi"}`, ""];

    if (dirtyItems.length === 0) {
      lines.push("Nessun capo sporco da ritirare.");
    } else {
      lines.push("Sporco da ritirare:");
      lines.push(...dirtyItems.map((item) => `- ${item.name}: ${item.dirtyAmount}`));
      lines.push("");
      lines.push(`Totale sporco: ${totals.dirtyAmount}`);
      lines.push(`Coppie possibili attuali: ${possiblePairs}`);
    }

    return lines.join("\n");
  }, [dayKey, items, possiblePairs, totals.dirtyAmount]);

  const orderMessage = useMemo(() => {
    const lines = [`Ordine biancheria ${dayKey || "oggi"}`, ""];

    if (reorderSuggestions.length === 0) {
      lines.push("Nessun articolo da ordinare.");
    } else {
      lines.push("Da ordinare:");
      lines.push(
        ...reorderSuggestions.map(
          (item) =>
            `- ${item.name}: ne hai ${item.quantity}, ordina almeno ${item.missingQuantity}`,
        ),
      );
    }

    return lines.join("\n");
  }, [dayKey, reorderSuggestions]);

  const activeMessage = reportType === "pickup" ? pickupMessage : orderMessage;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(activeMessage)}`;

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

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(activeMessage);
      setCopyStatus("Messaggio copiato");
    } catch {
      setCopyStatus("Copia non riuscita");
    }
  };

  const startDirtyEdit = (item: HistoryItem) => {
    setError(null);
    setDirtyStatus(null);
    setEditingDirtyId(item.id);
    setDirtyDraft(String(item.dirtyAmount));
  };

  const cancelDirtyEdit = () => {
    setEditingDirtyId(null);
    setDirtyDraft("");
    setDirtyBusyId(null);
  };

  const saveDirtyEdit = async (itemId: number) => {
    const nextDirtyAmount = Number(dirtyDraft);

    if (!Number.isInteger(nextDirtyAmount) || nextDirtyAmount < 0) {
      setError("Lo sporco deve essere un numero intero maggiore o uguale a 0");
      return;
    }

    try {
      setDirtyBusyId(itemId);
      setError(null);
      setDirtyStatus(null);

      const response = await fetch(`/api/products/${itemId}/dirty`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dirtyAmount: nextDirtyAmount }),
      });

      const data = (await response.json()) as DirtyUpdateResponse;

      if (!response.ok || !data.product) {
        throw new Error(data.error || "Impossibile aggiornare lo sporco");
      }

      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === itemId ? { ...item, dirtyAmount: data.product?.dirtyAmount ?? item.dirtyAmount } : item,
        ),
      );
      setDirtyStatus("Sporco aggiornato");
      setEditingDirtyId(null);
      setDirtyDraft("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore imprevisto";
      setError(message);
    } finally {
      setDirtyBusyId(null);
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
            Riepilogo
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Situazione biancheria</h1>
          <p className="mt-2 text-base leading-6 text-slate-600">
            Vedi subito sporco da ritirare, biancheria attuale e coppie possibili.
          </p>
          {dayKey ? (
            <p className="mt-2 text-sm text-slate-500">Data registro: {dayKey}</p>
          ) : null}
        </div>

        {reorderSuggestions.length > 0 ? (
          <section className="mb-4 rounded-[28px] border border-rose-200 bg-rose-50 p-5 shadow-[0_20px_50px_-30px_rgba(190,24,93,0.35)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-700">
                  Da Ordinare
                </p>
                <h2 className="mt-2 text-2xl font-bold text-rose-950">Hai poca disponibilita</h2>
                <p className="mt-2 text-sm leading-6 text-rose-800">
                  Il riordino parte solo quando un articolo scende sotto {reorderThreshold} pezzi.
                </p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-right ring-1 ring-rose-200">
                <p className="text-xs uppercase tracking-[0.18em] text-rose-500">Articoli</p>
                <p className="mt-1 text-2xl font-bold text-rose-950">{reorderSuggestions.length}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {reorderSuggestions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl bg-white px-4 py-4 ring-1 ring-rose-200"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-500">Disponibilita attuale: {item.quantity}</p>
                    </div>
                    <div className="rounded-2xl bg-rose-100 px-3 py-2 text-right text-rose-900">
                      <p className="text-xs uppercase tracking-[0.15em]">Ordina Almeno</p>
                      <p className="text-2xl font-bold">{item.missingQuantity}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <article className="rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-5 text-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.9)]">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-300">
            Coppie Possibili
          </p>
          <div className="mt-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-5xl font-bold">{loading ? "-" : possiblePairs}</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Calcolate solo sulle quantita attuali, non sullo sporco.
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-right ring-1 ring-white/15">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Formula</p>
              <p className="mt-1 text-base font-semibold">2 pezzi per articolo</p>
            </div>
          </div>
        </article>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <article className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Sporco Da Ritirare</p>
            <p className="mt-2 text-4xl font-bold">{loading ? "-" : totals.dirtyAmount}</p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-slate-950">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Biancheria Attuale</p>
            <p className="mt-2 text-4xl font-bold">{loading ? "-" : totals.quantity}</p>
          </article>
        </div>

        <section className="mt-5 rounded-[28px] border border-emerald-200 bg-emerald-50 p-5 shadow-[0_18px_40px_-30px_rgba(5,150,105,0.35)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
                Condivisione
              </p>
              <h2 className="mt-2 text-2xl font-bold text-emerald-950">Messaggio WhatsApp</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-900">
                Scegli il report, controlla il testo e poi copialo o aprilo su WhatsApp.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`min-h-12 rounded-2xl px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                reportType === "pickup"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-100"
              }`}
              onClick={() => {
                setReportType("pickup");
                setCopyStatus(null);
              }}
            >
              Ritiro sporco
            </button>
            <button
              type="button"
              className={`min-h-12 rounded-2xl px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                reportType === "order"
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-100"
              }`}
              onClick={() => {
                setReportType("order");
                setCopyStatus(null);
              }}
            >
              Ordine
            </button>
          </div>

          <div className="mt-4 rounded-3xl bg-white p-4 ring-1 ring-emerald-200">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-700">
              Anteprima
            </p>
            <pre className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
              {activeMessage}
            </pre>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="min-h-12 rounded-2xl bg-white px-4 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200 transition hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onClick={() => void handleCopyReport()}
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

          {copyStatus ? (
            <p className="mt-3 text-sm font-medium text-emerald-800">{copyStatus}</p>
          ) : null}
        </section>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {dirtyStatus ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {dirtyStatus}
          </div>
        ) : null}

        <div className="mt-5 rounded-3xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-700">
            Regola Coppie
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pairProductNames.map((name) => (
              <span
                key={name}
                className="rounded-full bg-white px-3 py-2 text-sm font-medium text-blue-900 ring-1 ring-blue-200"
              >
                {pairRequirements[name]} {name}
              </span>
            ))}
          </div>
          <p className="mt-3 text-sm leading-6 text-blue-900">
            Le coppie usano le quantita attuali. Il riordino invece parte solo sotto {reorderThreshold} pezzi.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-3xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="h-5 w-28 rounded bg-slate-200" />
                  <div className="mt-4 h-10 rounded-2xl bg-slate-200" />
                </div>
              ))
            : pairBreakdown.map((item) => (
                <article
                  key={item.id}
                  className={`rounded-3xl p-4 shadow-sm ring-1 ${
                    item.isLimiting
                      ? "border-rose-200 bg-rose-50 ring-rose-200"
                      : "border-slate-200 bg-slate-50 ring-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">{item.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">Conteggiato nelle coppie</p>
                    </div>
                    <div
                      className={`rounded-2xl px-3 py-2 text-sm font-semibold ${
                        item.isLimiting
                          ? "bg-rose-100 text-rose-800"
                          : "bg-white text-slate-700 ring-1 ring-slate-200"
                      }`}
                    >
                      {item.isLimiting ? "Limita le coppie" : `${item.pairsFromCurrent} coppie`}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Attuale</p>
                      <p className="mt-1 text-3xl font-bold text-slate-900">{item.quantity}</p>
                    </div>
                    <div
                      className={`rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 ${
                        editingDirtyId === item.id ? "sm:col-span-3" : ""
                      }`}
                    >
                      {editingDirtyId === item.id ? (
                        <div>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.15em] text-amber-700">Sporco</p>
                              <p className="mt-1 text-sm text-amber-900">
                                Correggi il numero reale di capi sporchi.
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                              Modifica attiva
                            </span>
                          </div>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            autoFocus
                            value={dirtyDraft}
                            onChange={(event) => setDirtyDraft(event.target.value)}
                            className="mt-3 h-14 w-full rounded-2xl border-2 border-amber-300 bg-white px-4 text-3xl font-bold text-amber-950 outline-none ring-0 focus:border-amber-500"
                          />
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              className="min-h-12 rounded-2xl bg-amber-600 px-3 text-sm font-semibold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={() => void saveDirtyEdit(item.id)}
                              disabled={dirtyBusyId === item.id}
                            >
                              {dirtyBusyId === item.id ? "Salvataggio..." : "Salva"}
                            </button>
                            <button
                              type="button"
                              className="min-h-12 rounded-2xl bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
                              onClick={cancelDirtyEdit}
                              disabled={dirtyBusyId === item.id}
                            >
                              Annulla
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-xs uppercase tracking-[0.15em] text-amber-700">Sporco</p>
                            <p className="mt-1 text-3xl font-bold text-amber-950">{item.dirtyAmount}</p>
                          </div>
                          <button
                            type="button"
                            className="min-h-11 rounded-2xl bg-white px-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            onClick={() => startDirtyEdit(item)}
                          >
                            Modifica
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.15em] text-blue-700">Da Solo</p>
                      <p className="mt-1 text-3xl font-bold text-blue-950">{item.pairsFromCurrent}</p>
                    </div>
                  </div>
                </article>
              ))}
        </div>

        {otherItems.length > 0 ? (
          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">
              Altri Prodotti
            </p>
            <div className="mt-3 space-y-3">
              {otherItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl bg-white px-4 py-4 ring-1 ring-slate-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-500">Non entra nel calcolo coppie</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Attuale</p>
                      <p className="text-2xl font-bold text-slate-900">{item.quantity}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    {editingDirtyId === item.id ? (
                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.15em] text-amber-700">Sporco</p>
                            <p className="mt-1 text-sm text-amber-900">
                              Correggi il numero reale di capi sporchi.
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                            Modifica attiva
                          </span>
                        </div>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          autoFocus
                          value={dirtyDraft}
                          onChange={(event) => setDirtyDraft(event.target.value)}
                          className="mt-3 h-14 w-full rounded-2xl border-2 border-amber-300 bg-white px-4 text-3xl font-bold text-amber-950 outline-none ring-0 focus:border-amber-500"
                        />
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            className="min-h-12 rounded-2xl bg-amber-600 px-3 text-sm font-semibold text-white transition hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={() => void saveDirtyEdit(item.id)}
                            disabled={dirtyBusyId === item.id}
                          >
                            {dirtyBusyId === item.id ? "Salvataggio..." : "Salva"}
                          </button>
                          <button
                            type="button"
                            className="min-h-12 rounded-2xl bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
                            onClick={cancelDirtyEdit}
                            disabled={dirtyBusyId === item.id}
                          >
                            Annulla
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-xs uppercase tracking-[0.15em] text-amber-700">Sporco</p>
                          <p className="mt-1 text-3xl font-bold text-amber-950">{item.dirtyAmount}</p>
                        </div>

                        <button
                          type="button"
                          className="min-h-11 rounded-2xl bg-white px-4 text-sm font-semibold text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          onClick={() => startDirtyEdit(item)}
                        >
                          Modifica
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
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
