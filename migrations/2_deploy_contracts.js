'use strict';

const FlightFuture = artifacts.require('./FlightFuture.sol');

module.exports = function(deployer) {
    deployer.deploy(FlightFuture);
};
