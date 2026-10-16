// The assistant's only server code: relays the conversation to the model through
// OpenRouter (or Vercel AI Gateway when no OpenRouter key is set). The tools below
// have no `execute`: the model asks for them, the browser runs them against the
// workpaper it already holds, and sends the results back. No client data is stored here.
import { streamText, convertToModelMessages, createUIMessageStreamResponse, toUIMessageStream, jsonSchema, type UIMessage, type Tool } from 'ai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

export const maxDuration = 60

const MAX_ROUNDS = Number(process.env.ASSISTANT_MAX_ROUNDS) || 3

// Keys pasted through some shells arrive with a byte-order mark or a newline; strip both.
const KEY = process.env.OPENROUTER_API_KEY?.replace(/[﻿\s]/g, '')
const openrouter = KEY ? createOpenAICompatible({ name: 'openrouter', baseURL: 'https://openrouter.ai/api/v1', apiKey: KEY }) : null
// Free models share rate-limited pools (Gemma 4's is often exhausted); OpenRouter moves to the
// next model in the list when one is throttled. Set ASSISTANT_MODEL to change the first choice.
const MODEL_ID = process.env.ASSISTANT_MODEL || (openrouter ? 'nvidia/nemotron-3-super-120b-a12b:free' : 'anthropic/claude-sonnet-5')
const MODEL = openrouter ? openrouter.chatModel(MODEL_ID) : MODEL_ID
const FALLBACKS = (process.env.ASSISTANT_FALLBACKS ?? '').split(',').filter((x) => x && x !== MODEL_ID)

const obj = (properties: Record<string, unknown>, required: string[] = []) =>
  jsonSchema({ type: 'object', properties, required, additionalProperties: false })
const str = (description: string) => ({ type: 'string', description })

const STAFF_TOOLS: Record<string, Tool> = {
  get_line: {
    description: 'One return line and its lineage: current value (with any adjustment), the engine rule, the lines it is built from (as a tree, `depth` levels down, each with its rule and source fields), the exact source fields (document, page, value as read), the lines that use it, and open issues on it. One call with depth 2 or 3 usually explains a whole number; do not fetch the input lines one by one.',
    inputSchema: obj({ key: str('Line key, e.g. F1040.11 or CA540NR.17'), depth: { type: 'integer', description: 'How many levels of inputs to expand, 1 to 3 (default 2)' } }, ['key']),
  },
  search_lines: {
    description: 'Find return lines by words in their label, form or key (e.g. "wages", "Schedule C", "capital gain", "SEP"). Returns key, label and value.',
    inputSchema: obj({ query: str('Words to look for') }, ['query']),
  },
  list_findings: {
    description: 'Issues raised by the independent checks, ranked by estimated tax at stake. Filter by status and area.',
    inputSchema: obj({ status: { type: 'string', enum: ['open', 'proposed', 'resolved', 'dismissed', 'all'], description: 'Default open' }, area: str('Optional area id or words, e.g. "california", "investments"') }),
  },
  get_finding: {
    description: 'One issue in full: what is wrong, the evidence (resolved to values), proposed corrections, estimated tax effect, next step, and what reviewers have done about it.',
    inputSchema: obj({ id: str('Finding id from list_findings') }, ['id']),
  },
  list_documents: {
    description: 'Every source document with where it landed: used (feeds lines), evidence (checks rely on it), record, superseded, duplicate, partial, unused, or pending (not arrived yet). Filter by status or words.',
    inputSchema: obj({ status: str('Optional: one status to keep, or "no_lines" for every arrived document that feeds no return line (records, evidence, duplicates, superseded, unused)'), query: str('Optional words, e.g. "1099" or a payer name') }),
  },
  get_document: {
    description: 'A source document: what it is, where it landed on the return, the values extracted from it, and the printed text of a page (or of every page when page is omitted).',
    inputSchema: obj({ id: str('Document id, e.g. D07'), page: { type: 'integer', description: 'Optional page number' } }, ['id']),
  },
  search_documents: {
    description: 'Full-text search over the printed text of every document that has arrived, and over extracted value labels. Use for names, payers, amounts, account numbers or phrases.',
    inputSchema: obj({ query: str('Text to find; case-insensitive') }, ['query']),
  },
  resolve_ref: {
    description: 'Look up any packet reference: ev-NNNN, D07, doc:D07#page2, qa-NN, msg-NN, call-NN, py:/pointer, agency:/pointer, asset:ID, household:ID, ref:param.NAME, v3.',
    inputSchema: obj({ ref: str('The reference') }, ['ref']),
  },
  get_client_communications: {
    description: 'What the client told the firm: questionnaire answers, messages, call notes and open question threads, up to today on the season clock. Optional words to filter by.',
    inputSchema: obj({ query: str('Optional words to filter by') }),
  },
  get_prior_year: {
    description: 'The 2024 return (lines, notes, sources), the prior preparer\'s memo, notes and open items, and carryovers into 2025. Optional words to filter by.',
    inputSchema: obj({ query: str('Optional words to filter by') }),
  },
  get_activity: {
    description: 'The workpaper history: who verified, adjusted, signed off, noted or filed what, plus sign-off status (current or reopened) and unresolved review notes. Optional words to filter by.',
    inputSchema: obj({ query: str('Optional words to filter by'), limit: { type: 'integer', description: 'Most recent N events, default 30' } }),
  },
}

const CLIENT_TOOLS: Record<string, Tool> = {
  get_client_communications: STAFF_TOOLS.get_client_communications,
}

const RULES = `You are the workpaper assistant inside Miraflores, a tax firm's review tool. You answer questions about ONE household's 2025 federal and California return, using only the workpaper data you can see or fetch with tools.

How to work:
- Lookups are slow and limited: plan them, request all you need together in one turn, never repeat a lookup you already have, and stop after at most 2 rounds. The context below already lists every open issue, so answer ranking questions from it directly.
- Look things up before answering. Never guess a number, a source or a status. If the tools do not show it, say you cannot find it.
- Never compute tax yourself. Dollar figures come from the tools. A "tax effect" is the dollar change times the engine's marginal rate: always call it an estimate.
- The engine's values and the extracted values can be wrong; printed document text is the truth. When they disagree, say so and cite both.
- Cite what you rely on in square brackets with the exact id, e.g. [F1040.11], [ev-0412], [D07], [doc:D07#page2], [qa-03], [msg-02], [finding:card-double-count]. Every number in your answer should have a citation next to it. Use only ids that a tool returned or that appear in the context. The brackets hold ids only: no words, no tool names. Write "Engagement letter [D01]", never "D01 [Engagement letter]" or "[get_line:F1040.11]".
- You are read-only. You cannot verify, adjust, sign off or file. If asked, explain where in the app the person can do it and what the firm rules require.
- Sensitive values (SSNs, bank accounts) are masked. Do not try to reconstruct them.
- Be brief and plain: short paragraphs or bullets, no tables wider than 3 columns, no em dashes. Start with the direct answer.`

const CLIENT_RULES = `You are talking with the client (the taxpayer), not firm staff. Explain in plain words, avoid form jargon, and only discuss what their portal shows: their totals, what the firm has asked them, and the status of approval and filing. For anything about how the firm reviewed the return, suggest they ask their preparer.`

export async function POST(req: Request): Promise<Response> {
  const raw = await req.text()
  if (raw.length > 400_000) return new Response('Conversation too long; start a new one.', { status: 413 })
  let body: { messages?: UIMessage[]; context?: string; role?: string }
  try { body = JSON.parse(raw) } catch { return new Response('Bad request', { status: 400 }) }
  const messages = (body.messages ?? []).slice(-40)
  if (!messages.length) return new Response('No messages', { status: 400 })
  const client = body.role === 'client'
  // Rounds of lookups already made for the current question; after MAX_ROUNDS, answer with what is known.
  const last = messages[messages.length - 1]
  const rounds = last.role === 'assistant' ? last.parts.filter((p) => p.type === 'step-start').length : 0
  const final = rounds >= MAX_ROUNDS

  const result = streamText({
    model: MODEL,
    system: `${RULES}${client ? `\n\n${CLIENT_RULES}` : ''}\n\n# Context right now\n${String(body.context ?? '').slice(0, 24_000)}${final ? '\n\n# No more lookups\nYou have used all your lookups for this question. Do not call or write out any tool call. Answer now from the results above, and say what you could not check.' : ''}`,
    messages: await convertToModelMessages(messages),
    // On the last round the tools are withdrawn, not just disabled: some models write a call out as text otherwise.
    tools: final ? {} : client ? CLIENT_TOOLS : STAFF_TOOLS,
    maxRetries: 2,
    maxOutputTokens: 2500,
    ...(openrouter ? { providerOptions: { openrouter: { models: [MODEL_ID, ...FALLBACKS] } } } : {}),
  })

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      onError: (e) => {
        // Provider bodies say which model failed and why (rate limit, bad request); keep them in the logs.
        const all = (e as { errors?: { responseBody?: string }[] }).errors ?? [e as { responseBody?: string }]
        for (const x of all) if (x?.responseBody) console.error('[assistant] provider error', x.responseBody.slice(0, 1500))
        return e instanceof Error ? e.message : 'The assistant could not answer.'
      },
    }),
  })
}
