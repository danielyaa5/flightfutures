'use strict';

const ConvertLib = artifacts.require('./ConvertLib.sol');
const FlightFuture = artifacts.require('./FlightFuture.sol');

module.exports = function(deployer) {
    deployer.deploy(ConvertLib);
    deployer.link(ConvertLib, FlightFuture);
    deployer.deploy(FlightFuture, { gas: 3999999 });
};
