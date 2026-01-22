#!/bin/bash
export DATABASE_URL="postgresql://panelx:panelx123@localhost:5432/panelx"
export PORT=5000
export NODE_ENV=development
export SESSION_SECRET="panelx-secret-key"
npx tsx server/index.ts
