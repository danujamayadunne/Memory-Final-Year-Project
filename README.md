# Memory

A personal knowledge base for saving web content, notes, and images, with semantic search and AI chat grounded in what you store.

## Features

- **Browser extension** — Chrome extension in `chrome-extension/` to send the current tab to Memory.
- **Summaries** — Paste a URL; content is fetched and summarized (papers, articles, blogs).
- **Semantic search** — Find items by meaning across your library.
- **Notes** — Rich editor with optional AI help; link notes to saved material.
- **Knowledge map** — Graph view of how topics and items connect.
- **Images** — Store images and search by description.
- **Chat** — Ask questions with answers tied to your saved sources.

## Tech stack

- **App** — [Next.js](https://nextjs.org) (App Router), React, TypeScript
- **UI** — Tailwind CSS
- **Data & auth** — [Supabase](https://supabase.com/)
- **AI** — Google Gemini, OpenAI, and Anthropic
- **Other** — TipTap (notes), embeddings/search, [Firecrawl](https://firecrawl.dev/) for URL extraction where used

## Install

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root with at least:

   | Variable | Purpose |
   |----------|---------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
   | `GOOGLE_GENERATIVE_AI_API_KEY` or `GOOGLE_GEMINI_API_KEY` | Default AI provider when the user has not set their own |
   | `FIRECRAWL_API_KEY` | Fetching and extracting content from URLs |
   | `ENCRYPTION_SECRET` | Optional; encrypts stored user API keys (falls back to anon key if unset) |

3. Run the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

4. Production build:

   ```bash
   npm run build
   npm start
   ```

## How to use

1. **Sign up / sign in** at `/signup` or `/signin` (Supabase auth).
2. **Dashboard** — After login, use the sidebar for Summaries, Memory (search), Notes, Map, Images, and Settings.
3. **Save content** — Add a URL from the app UI, or install the Chrome extension and use it while browsing (load `chrome-extension` as an unpacked extension in Chrome).
4. **AI providers** — In **Settings → AI model**, add your own API keys if you want to use OpenAI, Anthropic, Gemini, or a custom base URL instead of the server default.

## Scripts

- `npm run dev` — Development server  
- `npm run build` / `npm start` — Production build and server  
- `npm run lint` — ESLint  
- `npm test` — Vitest  
