# Contatore Lavanderia

Mini web app in Next.js per gestire le quantita dei prodotti lavanderia con PostgreSQL su Neon e Prisma ORM.

## 1. Comandi iniziali per creare il progetto

```bash
npx create-next-app@latest biancheria-counter --typescript --tailwind --eslint --app --use-npm
cd biancheria-counter
npm install prisma @prisma/client
npm install -D tsx
```

## 2. Installazione Prisma

```bash
npx prisma init
```

Poi configura `DATABASE_URL` e `DATABASE_URL_UNPOOLED` nel file `.env` partendo da `.env.example`.

## 3. Avvio locale

```bash
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

Apri http://localhost:3000.

## 4. API disponibili

- `GET /api/products` legge tutti i prodotti
- `PATCH /api/products/:id` con body `{ "action": "increment" }`
- `PATCH /api/products/:id` con body `{ "action": "decrement" }`

## 5. Deploy su Vercel con Neon

1. Crea un database su Neon.
2. Copia la stringa pooled in `DATABASE_URL`.
3. Copia la stringa diretta in `DATABASE_URL_UNPOOLED`.
4. Importa il repository su Vercel.
5. Aggiungi in Vercel le environment variables `DATABASE_URL` e `DATABASE_URL_UNPOOLED`.
6. Imposta il comando build standard: `npm run build`.
7. Esegui la migration verso Neon:

```bash
npx prisma migrate deploy
npm run prisma:seed
```

Puoi eseguire migration e seed da locale puntando al database Neon oppure in una pipeline CI.

## 6. Struttura del progetto

- `app/` pagina principale e API routes App Router
- `components/` componente frontend del contatore
- `lib/prisma.ts` singleton Prisma Client
- `prisma/schema.prisma` schema database
- `prisma/seed.ts` seed iniziale
