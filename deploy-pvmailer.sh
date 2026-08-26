#!/bin/bash
# PVMailer Safe Deploy Script
# SOT: https://github.com/kopipes/pvmailer.git
# DB SOT: VPS (SQLite in /var/www/pvmailer/data/ — never overwritten on deploy)
# Usage:
#   sudo bash /var/www/deploy-pvmailer.sh          # deploy latest from GitHub
#   sudo bash /var/www/deploy-pvmailer.sh rollback  # rollback to last backup

set -e

APP_DIR=/var/www/pvmailer
BACKUP_DIR=/var/www/pvmailer-backups
DB_DIR=$APP_DIR/data
REPO=https://github.com/kopipes/pvmailer.git
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PORT=3003
SERVICE=pvmailer

mkdir -p $BACKUP_DIR

# Ensure git trusts this directory
git config --global --add safe.directory $APP_DIR 2>/dev/null || true

# ── ROLLBACK ────────────────────────────────────────────────────────────────────
if [ "$1" == "rollback" ]; then
  LATEST=$(ls -t $BACKUP_DIR | grep -E '^[0-9]{8}_' | head -1)
  if [ -z "$LATEST" ]; then
    echo "No backups found in $BACKUP_DIR"
    exit 1
  fi
  echo "Rolling back to: $LATEST"

  # Preserve current DB before overwriting
  if [ -d "$DB_DIR" ]; then
    cp -r "$DB_DIR" "$BACKUP_DIR/rollback-db-$TIMESTAMP"
    echo "Current DB saved to $BACKUP_DIR/rollback-db-$TIMESTAMP"
  fi

  rsync -a --delete \
    --exclude='data/' \
    --exclude='.env' \
    "$BACKUP_DIR/$LATEST/" "$APP_DIR/"

  chown -R www-data:www-data $APP_DIR
  systemctl restart $SERVICE
  sleep 3
  systemctl is-active $SERVICE \
    && echo "Rollback complete to $LATEST — service running" \
    || echo "WARNING: Service failed to start — check: journalctl -u $SERVICE -n 20"
  exit 0
fi

# ── FORWARD DEPLOY ──────────────────────────────────────────────────────────────
echo "=== PVMailer Deploy $TIMESTAMP ==="

# 1. Backup current code (exclude data dir and node_modules — too large)
if [ -d "$APP_DIR/.git" ]; then
  echo "1. Backing up current version (code only)..."
  mkdir -p "$BACKUP_DIR/$TIMESTAMP"
  rsync -a \
    --exclude='data/' \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.env' \
    "$APP_DIR/" "$BACKUP_DIR/$TIMESTAMP/"
  echo "   Backup saved: $BACKUP_DIR/$TIMESTAMP"
else
  echo "1. No existing install — skipping backup."
fi

# 2. Backup DB separately
if [ -d "$DB_DIR" ]; then
  echo "2. Backing up database..."
  cp -r "$DB_DIR" "$BACKUP_DIR/db-$TIMESTAMP"
  echo "   DB backup: $BACKUP_DIR/db-$TIMESTAMP"
fi

# 3. Clone or pull from GitHub
echo "3. Pulling latest from GitHub..."
if [ -d "$APP_DIR/.git" ]; then
  cd $APP_DIR
  git fetch origin main
  git reset --hard origin/main
else
  TEMP_DIR=$(mktemp -d)
  git clone $REPO $TEMP_DIR
  mkdir -p $APP_DIR
  rsync -a --exclude='.env' --exclude='data/' $TEMP_DIR/ $APP_DIR/
  rm -rf $TEMP_DIR
  cd $APP_DIR
fi

# 4. Restore .env if missing — never overwrite existing production .env
if [ ! -f "$APP_DIR/.env" ]; then
  echo ""
  echo "   *** WARNING: No .env found at $APP_DIR/.env ***"
  echo "   Create it before starting the service:"
  echo "     sudo nano $APP_DIR/.env"
  echo ""
  echo "   Required variables:"
  echo "     RESEND_API_KEY=re_..."
  echo "     RESEND_WEBHOOK_SECRET=whsec_..."
  echo "     NEXTAUTH_SECRET=$(openssl rand -base64 32)"
  echo "     NEXTAUTH_URL=https://pvmailer.provaliantgroup.com"
  echo "     APP_BASE_URL=https://pvmailer.provaliantgroup.com"
  echo "     DEFAULT_ADMIN_EMAIL=admin@pvmailer.local"
  echo "     DEFAULT_ADMIN_PASSWORD=changeme123"
fi

# 5. Ensure data directory exists and is writable (DB SOT = VPS)
echo "4. Ensuring data directory..."
mkdir -p "$DB_DIR"
chown -R www-data:www-data "$DB_DIR"

# 6. Install all dependencies (including devDeps needed for build)
echo "5. Installing dependencies..."
cd $APP_DIR
npm ci

# 7. Build
echo "6. Building..."
NODE_ENV=production npm run build

# 7b. Prune devDependencies after build
echo "6b. Pruning dev dependencies..."
npm prune --omit=dev

# 8. Set ownership
echo "7. Setting file ownership..."
chown -R www-data:www-data $APP_DIR

# 9. Write systemd service
echo "8. Writing systemd service..."
cat > /etc/systemd/system/$SERVICE.service << SVCEOF
[Unit]
Description=PVMailer — Email Campaign App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
Environment=NODE_ENV=production
Environment=PORT=$PORT
Environment=TZ=Asia/Jakarta
ExecStart=/usr/bin/node node_modules/.bin/next start -p $PORT
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE

[Install]
WantedBy=multi-user.target
SVCEOF

# 10. Reload systemd and restart service
echo "9. Restarting service..."
systemctl daemon-reload
systemctl enable $SERVICE
if systemctl is-active --quiet $SERVICE; then
  systemctl restart $SERVICE
else
  systemctl start $SERVICE
fi
sleep 4
systemctl is-active $SERVICE \
  && echo "   Service is running OK" \
  || echo "   WARNING: Service failed to start — check: journalctl -u $SERVICE -n 30"

# 11. Keep last 5 timestamped code backups (preserve all DB backups)
echo "10. Cleaning old code backups (keeping last 5)..."
ls -t $BACKUP_DIR | grep -E '^[0-9]{8}_' | tail -n +6 | xargs -I{} rm -rf "$BACKUP_DIR/{}"

echo ""
echo "=== PVMailer Deploy Complete! ==="
echo "   App:      https://pvmailer.provaliantgroup.com"
echo "   Port:     $PORT"
echo "   Logs:     journalctl -u $SERVICE -f"
echo "   Status:   systemctl status $SERVICE"
echo "   Rollback: sudo bash /var/www/deploy-pvmailer.sh rollback"
