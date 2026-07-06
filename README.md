# ocarina-webapp

Web companion for the [Digital Ocarina](https://github.com/dtacci/digital-ocarina)
— a voice-to-instrument hardware synthesizer (Teensy 4.1 + Raspberry Pi 5).
The device is the performance half (real-time, offline); this app is the
memory + intelligence half: sample library + editor, session capture,
transcription → sheet music, looper/DJ tools, semantic search, live device
console, and the ML data flywheel.

- **Live**: [ocarina-webapp.vercel.app](https://ocarina-webapp.vercel.app)
- **Stack**: Next.js App Router + Supabase (auth/DB/Realtime, RLS) + Vercel Blob + Vercel AI SDK (Anthropic default) + Tone.js/WaveSurfer
- **Strategy & roadmap**: [`docs/STRATEGY.md`](docs/STRATEGY.md) → canonical doc lives in the device repo
- **Shipped log**: [`progress.md`](progress.md) · **Up next**: [`todo.md`](todo.md) · **Event schema**: [`docs/EVENTS.md`](docs/EVENTS.md)

## Development

```bash
npm install
npm run dev        # http://localhost:3000
```

Requires `.env.local` (Supabase keys, `NEXT_PUBLIC_OCARINA_API` +
`NEXT_PUBLIC_OCARINA_TOKEN` for live device features, `ANTHROPIC_API_KEY`,
optional `OPENAI_API_KEY` for embeddings). Device connectivity degrades
gracefully when the hardware is offline.
