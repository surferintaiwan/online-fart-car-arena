# Fart Car Arena

A real-time multiplayer browser game where players drive cars through a maze, collect beans, and use fart clouds to stun opponents.

## Gameplay

- Move your car through a randomly generated maze
- Collect beans to earn points
- Press **Space** to release a fart cloud — it stuns nearby players
- Each player has 3 lives; getting hit by a fart cloud costs a life
- Bot players fill the arena automatically
- Last one standing (or highest score) wins

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Canvas API |
| Styling | Tailwind CSS v4 |
| Real-time | Socket.IO (client + server) |
| Backend | Node.js, Express |
| Build | Vite 6 |
| Runtime | tsx (dev), Node.js (prod) |

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```
   npm install
   ```

2. (Optional) Copy `.env.example` to `.env.local` and configure:
   ```
   cp .env.example .env.local
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build frontend for production |
| `npm start` | Start production server |
| `npm run lint` | Type-check with TypeScript |
| `npm run clean` | Remove build output |

## Project Structure

```
├── server.ts          # Express + Socket.IO game server
├── src/
│   ├── main.tsx       # React entry point
│   ├── App.tsx        # Root component
│   └── components/
│       ├── Game.tsx   # Canvas game renderer + Socket.IO client
│       └── NameEntry.tsx  # Player name input screen
├── vite.config.ts     # Vite configuration
└── .env.example       # Environment variable reference
```
