#!/bin/bash
cd /home/user/webapp
export DATABASE_URL=postgresql://user:password@localhost:5432/panelx
export PORT=5000
export NODE_ENV=development
export SESSION_SECRET=panelx-super-secret-key-change-in-production
npm run dev
