'use strict';

/*
    TODO: Move into separate files
    TODO: Replace console.logs with debugs
 */

const fs = require('fs');
const solc = require('solc');
const ck = require('chronokinesis');
const TestRPC = require("ethereumjs-testrpc");
const Web3 = require('web3');

const constants = require('./constants');

const provider = TestRPC.provider();
const web3 = new Web3(provider);
const FlightFuture = artifacts.require('./FlightFuture');

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
const info = web3.eth.getBlock('latest');

console.log(`\ngasLimit: ${info.gasLimit}`);
console.log(`gasPrice: ${web3.eth.gasPrice.toString(10)}\n`);

// Helper Funcs
const estimateGas = method => { return method.estimateGas() }; // TODO: why doesn't this work?
const createDateString = date => `${date.getMonth()}/${date.getDate()}/${date.getFullYear()}`;


const sources = {
    'FlightFuture.sol': fs.readFileSync(__dirname + '/../contracts/FlightFuture.sol', 'utf8'),
    'installed_contracts/zeppelin/contracts/ownership/Ownable.sol': fs.readFileSync(__dirname + '/../installed_contracts/zeppelin/contracts/ownership/Ownable.sol', 'utf-8'),
    'installed_contracts/zeppelin/contracts/payment/PullPayment.sol': fs.readFileSync(__dirname + '/../installed_contracts/zeppelin/contracts/payment/PullPayment.sol', 'utf-8'),
    'installed_contracts/zeppelin/contracts/SafeMath.sol': fs.readFileSync(__dirname + '/../installed_contracts/zeppelin/contracts/SafeMath.sol', 'utf-8'),
    'installed_contracts/oraclize/oraclizeAPI_0.4.sol': fs.readFileSync(__dirname + '/../installed_contracts/oraclize/oraclizeAPI_0.4.sol', 'utf-8'),
    'Converter.sol': fs.readFileSync(__dirname + '/../contracts/Converter.sol', 'utf-8')
};
const compiledContract = solc.compile({ sources }, 1);
const abi = compiledContract.contracts['FlightFuture.sol:FlightFuture'].interface;
const bytecode = compiledContract.contracts['FlightFuture.sol:FlightFuture'].bytecode;
const contract_creation_gas = web3.eth.estimateGas({data: bytecode});

const marked = function marked(web3) {
    contract('Marked', () => {

    });
};

const balanceVerified = function balanceVerified(web3) {
    contract('BalanceVerified', () => {

    });
};

const buyingTicket = function buyingTicket(web3) {
    contract('BuyingTicket', () => {

    });
};

const ticketPurchased = function offered(web3) {
    contract('TicketPurchased', () => {

    });
};

const expired = function expired(web3) {
    contract('Expired', () => {

    });
};

const defaulted = function defaulted(web3) {
    contract('Defaulted', () => {

    });
};

const nascent = require('./nascent.state');
const offered = require('./offered.state.js');
const purchased = require('./purchased.state');

contract('FlightFuture', () => {
    nascent(web3);
    offered(web3);
    purchased(web3);
    // marked(web3);
    // balanceVerified(web3);
    // buyingTicket(web3);
    // ticketPurchased(web3);
    // expired(web3);
    // defaulted(web3);
});