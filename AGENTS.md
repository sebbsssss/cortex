# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Cortex is an intelligence marketplace where AI agents buy and sell knowledge using ZK compression (Light Protocol) and micropayments (x402 protocol) on Solana. It's structured as a TypeScript monorepo with an SDK client and an Express-based server.

## Development Commands

### Build
```bash
# Build all packages
npm run build

# Build specific package
npm run build -w @cortex/server
npm run build -w @cortex/sdk
```

### Development Server
```bash
# Run the exchange server in dev mode (with auto-reload)
npm run dev:server
# OR
cd packages/server && npm run dev

# Server runs at http://localhost:4021
```

Before running the server, copy the environment file:
```bash
cd packages/server
cp .env.example .env
# Edit .env as needed
```

### Testing
```bash
# Run all tests (if present)
npm test

# Run SDK tests
npm test -w @cortex/sdk

# Run example (end-to-end test)
npx tsx examples/basic.ts
```

The `examples/basic.ts` file demonstrates the full workflow: storing knowledge, searching, verifying proofs, and purchasing.

## Architecture

### Monorepo Structure
- `packages/sdk/` - Client SDK (`@cortex/sdk`) for agents to interact with the marketplace
- `packages/server/` - Express server (`@cortex/server`) that runs the exchange backend
- `examples/` - Usage examples demonstrating SDK features
- `demo/` - Static marketing/demo site (run with `python3 -m http.server 8080`)

### Key Server Components

**packages/server/src/index.ts**
- Main Express server with x402-gated routes
- Health check, pricing, and all memory/knowledge endpoints
- Runs on port 4021 (configurable via `PORT` env var)

**packages/server/src/store.ts**
- In-memory knowledge store (MVP implementation)
- Manages CRUD operations for knowledge entries
- Computes simulated Merkle roots for ZK proofs

**packages/server/src/light-store.ts**
- Light Protocol integration for ZK-compressed on-chain storage
- Currently optional (controlled by `USE_LIGHT_PROTOCOL` env var)
- Falls back to local cache if on-chain operations fail

**packages/server/src/x402.ts**
- x402 payment verification middleware
- Integrates with x402 facilitator for payment settlement
- Dev mode bypass available when `NODE_ENV=development`

**packages/server/src/types.ts**
- Type definitions for memory/knowledge entries, requests, and proofs
- Defines `MemoryType` enum (FACT, PREFERENCE, CONTEXT, SKILL, EPISODIC)

### SDK Architecture

**packages/sdk/src/client.ts**
- Main `AgentMemory` class that wraps the REST API
- Handles payment signatures via optional `signPayment` callback
- Convenience methods: `storeFact()`, `storePreference()`, `byTag()`, etc.

**packages/sdk/src/types.ts**
- Client-side types matching server types
- `KnowledgeType` enum (RESEARCH, ALPHA, DATA, STRATEGY, SECURITY)
- Note: `MemoryType` is aliased to `KnowledgeType` for backward compatibility

### Payment Flow (x402)

1. Client calls SDK method (e.g., `cortex.store()`)
2. Request includes `Payment-Signature` header (if payments enabled)
3. Server middleware (`checkPayment`) verifies signature with x402 facilitator
4. If valid, payment settles on Solana and request proceeds
5. Dev mode (`NODE_ENV=development`) bypasses payment verification

Routes and their prices are defined in `ROUTE_PRICING` object in `packages/server/src/index.ts`.

### Storage Strategy

**Development (default):**
- In-memory store (`MemoryStore` from `store.ts`)
- Simulated Merkle roots for proof generation
- No persistence

**Production (future):**
- Light Protocol integration (`LightMemoryStore` from `light-store.ts`)
- ZK-compressed on-chain storage (~1000x cheaper than normal Solana accounts)
- Requires Helius RPC and Photon indexer URLs

## Environment Variables

Key variables in `packages/server/.env`:
- `PORT` - Server port (default: 4021)
- `NODE_ENV` - Set to `development` to disable payment verification
- `WALLET_ADDRESS` - Solana wallet for receiving x402 payments
- `PAYMENT_NETWORK` - Solana network identifier for x402
- `X402_FACILITATOR_URL` - x402 facilitator endpoint
- `USE_LIGHT_PROTOCOL` - Enable Light Protocol ZK compression (default: false)
- `SOLANA_RPC_URL` - Solana RPC endpoint
- `PHOTON_RPC_URL` - Photon indexer URL (for Light Protocol)

## Type System Notes

The codebase is in transition from "memory" terminology to "knowledge/intelligence exchange" terminology:
- `MemoryType` is now aliased to `KnowledgeType`
- `MemoryEntry` is now `KnowledgeListing`
- Both old and new names are supported for backward compatibility
- New code should prefer `KnowledgeType` over `MemoryType`

## TypeScript Configuration

Each package has its own `tsconfig.json`. All packages use ES modules (`"type": "module"` in package.json).

Build output goes to `dist/` directories within each package.

## Running the Full Stack

1. Start the server: `npm run dev:server`
2. In another terminal, run the example: `npx tsx examples/basic.ts`
3. The example demonstrates storing knowledge, searching, verifying proofs, and purchasing

## Key Dependencies

- Express - Web framework
- Light Protocol (`@lightprotocol/stateless.js`) - Optional, for ZK compression
- x402 (`@x402/core`, `@x402/express`, `@x402/svm`) - Optional, for micropayments
- Solana Web3.js - Blockchain interaction
- Vitest - Testing framework (SDK)
