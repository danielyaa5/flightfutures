'use strict';

const TestRPC = require("ethereumjs-testrpc");
const server = TestRPC.server({ total_accounts: 50 });
const port = 8545;

server.listen(port, function(err, blockchain) {
   console.log(err, blockchain);
});