#!/bin/bash
# AgriFriend Bot — One-click setup for Hostinger VPS (Ubuntu)
set -e

echo "🌱 AgriFriend Bot Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Update system
echo "📦 Updating system..."
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 22.x
echo "📦 Installing Node.js..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
fi
echo "Node: $(node -v) | npm: $(npm -v)"

# 3. Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -y -g pm2

# 4. Navigate to project directory
cd "$(dirname "$0")"

# 5. Install dependencies
echo "📦 Installing bot dependencies..."
npm install

# 6. Copy .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Created .env from template — edit it and add your GEMINI_API_KEY"
fi

# 7. Create data directories
mkdir -p data auth_info

# 8. Build TypeScript
echo "🔨 Building..."
npm run build

# 9. Start with PM2
echo "🚀 Starting AgriFriend with PM2..."
pm2 delete agrifriend 2>/dev/null || true
pm2 start dist/index.js --name agrifriend
pm2 save

# 10. Setup auto-start on reboot
pm2 startup systemd -u $USER --hp $HOME | tail -1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ AgriFriend Bot is running!"
echo ""
echo "Next steps:"
echo "  1. Edit .env and add your GEMINI_API_KEY"
echo "  2. Run: pm2 restart agrifriend"
echo "  3. Scan the QR code that appears in logs: pm2 logs agrifriend"
echo ""
echo "Useful commands:"
echo "  pm2 logs agrifriend     — view live logs"
echo "  pm2 restart agrifriend  — restart bot"
echo "  pm2 stop agrifriend     — stop bot"
echo "  pm2 status              — check status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
