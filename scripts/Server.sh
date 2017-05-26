#!/bin/bash
parent_path=$( cd "$(dirname "${BASH_SOURCE[0]}")" ; pwd -P )
cd "$parent_path"

. ~/.nvm/nvm.sh use stable && node -v && kill -9 $(lsof -i tcp:3031);
cd ../server && DEBUG=* npm start &
