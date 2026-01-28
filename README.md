# Hubris - Track Everything

A modern, local-first tracking app for activities, habits, and goals.

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Mobile**: React Native + Expo + TypeScript + SQLite
- **Extension**: React + Vite + TypeScript + IndexedDB
- **Backend** (future): Fastify + Prisma + PostgreSQL

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev

# Build all packages
pnpm build

# Type check
pnpm type-check
```

## Project Structure

```
hubris/
├── apps/
│   ├── mobile/          # React Native + Expo app
│   └── extension/       # Chrome Extension
├── packages/
│   ├── types/           # Shared TypeScript types
│   └── core/            # Business logic (scoring, streaks)
├── turbo.json           # Turborepo config
├── pnpm-workspace.yaml  # Workspace config
└── tsconfig.base.json   # Base TS config
```

## Features

- ⚡ 2-second quick logging
- 📊 GitHub-style heatmaps
- 🎯 Frequency-based scoring
- 💡 Smart suggestions
- 📱 Mobile-first design
- 🔌 Chrome extension for desktop
