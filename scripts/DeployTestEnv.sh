#!/bin/bash

. ~/.nvm/nvm.sh use stable && ttab -w ./scripts/TestRPC.sh; ttab ./scripts/EthereumBridge.sh; ttab ./scripts/Server.sh