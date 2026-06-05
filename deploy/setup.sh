#!/bin/bash
# HR Football Game - LightSail server setup script
# Run once after the instance boots: bash setup.sh

set -e

GITHUB_TOKEN="$1"
if [ -z "$GITHUB_TOKEN" ]; then
  echo "Usage: bash setup.sh <github-token>"
  exit 1
fi

echo "=== Installing Docker ==="
apt-get update -qq
apt-get install -y -qq docker.io docker-compose-plugin curl

systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

echo "=== Logging in to GitHub Container Registry ==="
echo "$GITHUB_TOKEN" | docker login ghcr.io -u RusselR00 --password-stdin

echo "=== Pulling images ==="
docker pull ghcr.io/russelr00/hr-football-server:latest
docker pull ghcr.io/russelr00/hr-football-client:latest

echo "=== Creating docker-compose.yml ==="
cat > /home/ubuntu/docker-compose.yml << 'EOF'
version: '3.8'

services:
  server:
    image: ghcr.io/russelr00/hr-football-server:latest
    ports:
      - "3001:3001"
    restart: unless-stopped
    environment:
      - PORT=3001

  client:
    image: ghcr.io/russelr00/hr-football-client:latest
    ports:
      - "80:80"
    restart: unless-stopped
    depends_on:
      - server
EOF

echo "=== Starting containers ==="
cd /home/ubuntu
docker compose up -d

echo ""
echo "=== Installing Tailscale ==="
curl -fsSL https://tailscale.com/install.sh | sh

echo ""
echo "============================================================"
echo " Setup complete!"
echo " App is running at http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)"
echo ""
echo " To enable HTTPS via Tailscale Funnel, run:"
echo "   tailscale up"
echo "   tailscale funnel 80"
echo " Then share the https://... URL with players."
echo "============================================================"
