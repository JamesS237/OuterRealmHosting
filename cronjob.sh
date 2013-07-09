#!/bin/sh

cp -R /home/ubuntu/server /tmp/backup/server
cd /tmp/backup
tar -czf backup.tar.gz server/
nodejs /home/ubuntu/backupserver.js -f /tmp/backup/backup.tar.gz
sudo rm -rf /tmp/backup