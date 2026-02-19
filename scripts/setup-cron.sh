#!/bin/bash
# Setup script for daily notification cron on the Pi
# Run this once on the Pi to configure the systemd timer

set -e

HOUR="${NOTIFICATION_HOUR:-9}"

# Create the notification script
cat > /tmp/flashcards-notify.sh << 'SCRIPT'
#!/bin/bash
if [ -z "$CRON_SECRET" ]; then
  echo "ERROR: CRON_SECRET not provided via EnvironmentFile" >&2
  exit 1
fi

curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/notifications/send-daily
SCRIPT

sudo mv /tmp/flashcards-notify.sh /usr/local/bin/flashcards-notify.sh
sudo chmod 700 /usr/local/bin/flashcards-notify.sh

# Create systemd service with EnvironmentFile
sudo tee /etc/systemd/system/flashcards-notify.service > /dev/null << EOF
[Unit]
Description=Send flashcard review notifications

[Service]
Type=oneshot
EnvironmentFile=/home/admin/flashcards/.env
ExecStart=/usr/local/bin/flashcards-notify.sh
EOF

sudo tee /etc/systemd/system/flashcards-notify.timer > /dev/null << EOF
[Unit]
Description=Daily flashcard notification timer

[Timer]
OnCalendar=*-*-* ${HOUR}:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now flashcards-notify.timer

echo "Timer configured for ${HOUR}:00 daily"
echo "Check status: systemctl status flashcards-notify.timer"
