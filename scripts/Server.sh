#!/bin/bash

. ~/.nvm/nvm.sh use stable && node -v && kill -9 $(lsof -i tcp:3031); ttab '. ~/.nvm/nvm.sh use stable && node -v && ngrok http 3031' &
cd server && DEBUG=* npm start &
