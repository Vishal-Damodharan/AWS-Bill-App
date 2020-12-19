#!/bin/bash
cd /home/ubuntu/webApp
pwd 
ls
pm2 stop index.js
pm2 delete index.js