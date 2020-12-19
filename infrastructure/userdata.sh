#!/bin/bash

endpoint=$(aws rds describe-db-cluster-endpoints)
mkdir -p /home/ubuntu/csye6225/dev/webapp/ 
sudo chown -R ubuntu:ubuntu home/ubuntu/csye6225
sudo echo DB_USER="dbuser" >> /home/ubuntu/csye6225/dev/webapp/.env
sudo echo DB_NAME= "csye6225" >>  /home/ubuntu/csye6225/dev/webapp/.env
sudo echo DB_PASSWORD= "mdv235316113" >>  /home/ubuntu/csye6225/dev/webapp/.env
sudo echo DB_HOST=$(endpoint) | sed s/:5432//g  >>  /home/ubuntu/csye6225/dev/webapp/.env
sudo echo port1= "5000" >>  /home/ubuntu/csye6225/dev/webapp/.env
