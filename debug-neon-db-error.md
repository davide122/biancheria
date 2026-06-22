# Debug Session: neon-db-error

## Status
- [OPEN]

## Symptom
- La UI riceve `{"error":"Database non raggiungibile. Controlla le variabili Neon."}` dalla route backend.

## Hypotheses
- `DATABASE_URL` e` caricata correttamente ma lo schema del database non e allineato con Prisma.
- La tabella `Product` esiste ma manca la colonna `dirtyAmount`.
- Le nuove entita dello storico non sono ancora state applicate su Neon.
- La connessione arriva a Neon ma Prisma fallisce durante la query a causa di mismatch schema/runtime.

## Evidence Log
- `npx prisma migrate status`: connessione a Neon riuscita, ma nessuna migration Prisma presente nel progetto.
- Query runtime Prisma: `PrismaClientKnownRequestError P2021`
- Dettaglio errore: `The table public.Product does not exist in the current database.`

## Next Step
- Schema applicato con `npx prisma db push`, seed eseguito e query Prisma verificata con successo.
- In attesa di conferma utente dopo refresh della UI.
