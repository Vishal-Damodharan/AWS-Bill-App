#!/bin/bash
pwd
sudo chown -R ubuntu:ubuntu /home/ubuntu/webApp
cd
pwd
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c file:/home/ubuntu/cloudwatch-config.json \
    -s
    
cd /home/ubuntu/webapp
pwd
sudo chown ubuntu app.log
sudo chown ubuntu error.log
pwd 
ls -al
sudo chmod 664 ubuntu.log
sudo chmod 664 ubuntu.log
pwd ls -al
cp .env /home/ubuntu/webApp
cd webApp
pwd
curl -sSL "https://nodejs.org/dist/v11.10.0/node-v11.10.0-linux-x64.tar.xz" | sudo tar --strip-components=2 -xJ -C /usr/local/bin/ node-v11.10.0-linux-x64/bin/node
curl https://www.npmjs.com/install.sh | sudo bash
sudo npm install
sudo npm install -g pm2
sudo cp /var/postgres-certs/rds-ca-2019-root.pem ~/webApp
sudo apt-get install postgresql-client -y
pm2 start index.js --name "webapp"
