#!/bin/bash -e

main() {
  pwd
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash
  . ~/.nvm/nvm.sh
  sudo apt-get update
  sudo apt-get install unzip
  sudo apt-get install postgresql-client-common
    sudo apt-get update
  sudo apt-get install postgresql-client-common
  sudo apt-get install ruby-full -y
  sudo apt-get install wget -y
  cd /home/ubuntu
  wget https://aws-codedeploy-us-east-1.s3.us-east-1.amazonaws.com/latest/install
  chmod +x ./install
  sudo ./install auto 
  wget https://aws-codedeploy-us-east-2.s3.us-east-2.amazonaws.com/latest/install
  chmod +x ./install
  sudo ./install auto  
  nvm install node
  node --version
  npm --version
  npm install express
  npm install nodemon
  npm install morgan
  npm install multer
  npm install multer-s3
  npm install pg
  npm install email-validator
  npm install aws-sdk
  npm install basic-auth
  npm install basic-auth-connect
  npm install bcrypt
  npm install dotenv
  npm install express-basic-auth
  npm install password-validator
  npm install tsscmp
}

main