#!/bin/bash 
echo "========================================" 
echo "  AutoReel Post VPS - Starting..."  
echo "========================================" 
cd "$(dirname "$0")" 
npm install --production 
echo "" 
echo "Starting with PM2..." 
pm2 start server.js --name "AutoReel" -- 
pm2 save 
echo "" 
echo "AutoReel is now running! Access at http://YOUR_VPS_IP:5005" 
