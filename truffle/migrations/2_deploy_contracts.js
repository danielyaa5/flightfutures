'use strict';

const Dao = artifacts.require('./Dao.sol');
const Future = artifacts.require('./Future.sol');
const Converter = artifacts.require('./Converter.sol');

module.exports = function(deployer) {
    deployer.deploy(Converter);
    deployer.link(Converter, Dao);
    deployer.link(Converter, Future);
    deployer.deploy(Dao);
};
