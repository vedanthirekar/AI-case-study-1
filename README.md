# Miraflores

A web-native tax workpaper: where a tax firm prepares, reviews and files a client's return. Built as a case study for MiraFlores AI, using one household's 2025 return (the Okafor-Lindqvist family, federal and California) from the provided data packet.

- **Live app:** https://miraflores.vedanthirekar.com
- **Approach and key decisions:** https://miraflores.vedanthirekar.com/handin

## Try it

1. Open the app and click **Start the tour** on the client list. This loads a week of sample review work, so the return is halfway through review.
2. The **Return map** opens: the whole return as one graph, with income on the left flowing to what is owed on the right. Hover an issue under **Needs attention** to see which boxes it affects. Click any box to see how it was built, down to the exact field on the source document.
3. Switch people from the menu at top right (preparer, reviewer, partner, client and others). Anything that person can't do stays visible but disabled, with the reason.
4. Use the date at the top to replay the tax season: documents arriving, the filing, and letters from the IRS.
5. Click **Ask Mira** to ask questions about the client's file in plain English.

The reset icon at top right clears your work or reloads the sample work. Everything is saved in your browser.

## Core idea

- **The return is a graph.** Every number links to the numbers it is computed from and, at the bottom, to the exact field on a source document. The return map and the trace panel are two views of that graph.
- **Work is a log of actions, not edits.** Verifying, proposing a change, approving, signing and filing are each saved as an event. The packet itself is never modified. Every screen is built from the packet plus the events, so all screens always agree, and undo just adds a reversing event.
- **Sign-offs are content hashes.** A sign-off records a hash of everything it covers. If anything under it changes, it reopens and shows exactly what changed.
- **Issues come from checks, not hard-coded findings.** 20 general checks compare the return with the documents, IRS records and client answers. They find all 17 errors planted in the packet, ranked by estimated tax effect.
- **One place for firm rules.** Who can approve, reveal SSNs or file is decided by a single pure function (`checkRules`) that every action passes through.

## Tax effect is an estimate

The tax engine that produced the return can't be rerun here. Tax effect is the dollar change multiplied by the per-dollar rates the packet provides (`return_versions[].tax_effect_rates`), and it is labelled as an estimate everywhere it appears. It drives the issue ranking and the partner approval threshold.

## Ask Mira

A read-only assistant that answers questions about the client's file and cites its sources as clickable references.

- The only server code is [api/chat.ts](api/chat.ts), which relays to OpenRouter and holds the tool schemas.
- The tools run in the browser over the model, the derived workpaper and the checks ([src/features/assistant/tools.ts](src/features/assistant/tools.ts)). SSNs and account numbers are masked before anything is sent.
- It never does its own tax math. No vector database or graph RAG at this size; with many clients, the data would move to a graph database with a vector index for letters, notes and messages.

## Running locally

Requires Node 20 or later.

```bash
npm install
npm run dev        # http://localhost:5173 (also serves api/chat for Mira)
npm run build      # type-check and production build into dist/
npm run preview    # serve the built app
```

Mira needs an OpenRouter key. Create `.env.local` (gitignored):

```bash
OPENROUTER_API_KEY=sk-or-...
ASSISTANT_MODEL=nvidia/nemotron-3-super-120b-a12b:free   # optional, this is the default
ASSISTANT_FALLBACKS=                                     # optional, comma-separated model ids
ASSISTANT_MAX_ROUNDS=3                                   # optional, tool rounds before forcing an answer
```

Everything except Mira works without a key.

## Project structure

```
api/chat.ts                 Mira's relay to OpenRouter (the only server code)
public/
  okafor_lindqvist_2025_packet.json   the data packet, exactly as delivered
  handin/index.html         the hand-in notes, served at /handin
src/
  lib/packet/               loads the packet into a model; areas of the return
  lib/workpaper/            events, derive (packet + events -> current state), tax effect
  lib/checks/               the 20 checks that surface issues
  lib/rules/                checkRules: role and firm-standard rules
  lib/store/                EventStore over IndexedDB, synced across tabs
  lib/demo/seed.ts          the sample review work behind "Start the tour"
  lib/paths.ts              every URL in the app
  features/map/             the return map
  features/graph/           lineage graphs (React Flow + dagre)
  features/trace/           the trace panel
  features/assistant/       Mira
  pages/                    clients, return map, review, documents, schedules, filing, portal
  components/               shared UI primitives
```

## Tech

Vite, React 18, TypeScript, Tailwind CSS, React Router, Zustand, IndexedDB (`idb`), React Flow (`@xyflow/react`) with dagre for the graphs, and the Vercel AI SDK for Mira. Deployed on Vercel.

## Tradeoffs

Built in about two days, so I cut infrastructure, not features. Every requirement in the brief works.

- **No server database.** Work is saved in the browser (IndexedDB) and synced live across tabs. The event store sits behind an interface, so a server-backed store could replace it without changing the rest of the app.
- **No login.** The people you can act as come from the client data, and the rules change with the person you pick.
- **Masking happens in the browser.** In production the server would mask SSNs so full numbers never leave it for people without clearance. Every reveal is already logged.
- **Simulated source documents.** Documents render from the packet's printed content behind a single provider, so real PDFs could replace them.
