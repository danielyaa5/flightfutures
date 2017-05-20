'use strict';

const Dao = artifacts.require('./Dao.sol');
const Future = artifacts.require('./Future.sol');

module.exports = function(deployer) {
    deployer.deploy(Dao);
};
