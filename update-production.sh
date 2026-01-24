#!/bin/bash

# PanelX Production Server Update Script
# Server: 69.169.102.47:5000
# Commit: 1db7f96

set -e

echo "🚀 PanelX Update Starting..."
echo ""

# Stop service
echo "⏸️  Stopping service..."
sudo systemctl stop panelx
echo "✅ Service stopped"
echo ""

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git fetch origin main
git reset --hard origin/main
COMMIT=$(git log -1 --oneline)
echo "✅ Updated to: $COMMIT"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install --silent
echo "✅ Dependencies installed"
echo ""

# Start service
echo "🚀 Starting service..."
sudo systemctl start panelx
sleep 3
echo ""

# Verify
echo "🔍 Verifying server..."
if curl -s http://localhost:5000/api/stats | grep -q "totalStreams"; then
  echo "✅ Server is responding!"
  echo ""
  echo "✅ UPDATE COMPLETE!"
  echo ""
  echo "📊 Stats:"
  curl -s http://localhost:5000/api/stats | jq '.'
  echo ""
  echo "🌐 Access panel: http://69.169.102.47:5000/"
  echo "👤 Login: admin / admin123"
  echo ""
  echo "⚠️  IMPORTANT: Clear browser cache!"
  echo "   Press: Ctrl+Shift+R"
  echo ""
  echo "🧪 Test these features:"
  echo "   • Stream Control buttons (Start/Stop/Restart)"
  echo "   • Export buttons (CSV/Excel/M3U)"
  echo "   • Bulk Edit streams"
  echo "   • M3U Import"
else
  echo "❌ Server not responding!"
  echo "Check logs: sudo journalctl -u panelx -n 50"
  exit 1
fi
