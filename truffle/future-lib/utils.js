'use strict';

const fs = require('fs');
const solc = require('solc');
const TestRPC = require('ethereumjs-testrpc');
const Web3 = require('web3');
const Promise = require('bluebird');

const provider = TestRPC.provider({ mnemonics: "flight future mnemonic", total_accounts: 50 });
const web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));

const constants = require('./constants');

///////////////
/// General ///
///////////////
module.exports.pretty = function pretty(x) {
    return JSON.stringify(x, null, 2);
};

module.exports.toPSTString = function toPSTString(date) {
    date = new Date(date);
    const offset = -7;
    return new Date( date.getTime() + offset * 3600 * 1000).toUTCString().replace( / GMT$/, ' PST' );
};

module.exports.createDateString = date => `${date.getMonth()}/${date.getDate()}/${date.getFullYear()}`;

module.exports.percentDiff = (val1, val2) => {
    val1 = Number(val1);
    val2 = Number(val2);

    return (Math.abs(val1-val2)/((val1 + val2)/2)) * 100;
};

//////////////
/// Errors ///
//////////////
module.exports.isInvalidJumpErr = (err) => err && err.toString().includes('invalid jump at');
module.exports.isInvalidOpcodeErr = (err) => err && err.toString().includes('invalid opcode');
module.exports.isInvalidAddressErr = (err) => err && err.toString().includes('invalid address');

////////////
/// Web3 ///
////////////
module.exports.web3 = web3;

const sources = {
    'FlightFuture.sol': fs.readFileSync(__dirname + '/../contracts/FlightFuture.sol', 'utf8'),
    'installed_contracts/zeppelin/contracts/ownership/Ownable.sol': fs.readFileSync(__dirname + '/../installed_contracts/zeppelin/contracts/ownership/Ownable.sol', 'utf-8'),
    'installed_contracts/zeppelin/contracts/payment/PullPayment.sol': fs.readFileSync(__dirname + '/../installed_contracts/zeppelin/contracts/payment/PullPayment.sol', 'utf-8'),
    'installed_contracts/zeppelin/contracts/SafeMath.sol': fs.readFileSync(__dirname + '/../installed_contracts/zeppelin/contracts/SafeMath.sol', 'utf-8'),
    'installed_contracts/oraclize/oraclizeAPI_0.4.sol': fs.readFileSync(__dirname + '/../installed_contracts/oraclize/oraclizeAPI_0.4.sol', 'utf-8'),
    'Purchasable.sol': fs.readFileSync(__dirname + '/../contracts/Purchasable.sol', 'utf-8'),
    'Converter.sol': fs.readFileSync(__dirname + '/../contracts/Converter.sol', 'utf-8')
};
module.exports.compiledContracts = solc.compile({ sources }, 1);

module.exports.waitForEvent = function(event, timeout) {
    return new Promise((resolve, reject) => {
        event.watch((err, res) => {
            if (err) return reject(err);
            return resolve(res);
        });
    }).finally(() => event.stopWatching());
};

module.exports.getTransactionReceiptMined = function (txnHash, interval) {
    interval = interval ? interval : 500;
    console.log(txnHash);
    const transactionReceiptAsync = function(txnHash, resolve, reject) {
        try {
            web3.currentProvider.getTransactionReceipt(txnHash, (err, receipt) => {
                if (err) return reject(err);

                console.log('Receipt', receipt);
                if (!receipt) {
                    setTimeout(function () {
                        transactionReceiptAsync(txnHash, resolve, reject);
                    }, interval);
                } else {
                    resolve(receipt);
                }
            });
        } catch(e) {
            reject(e);
        }
    };

    if (Array.isArray(txnHash)) {
        const promises = [];
        txnHash.forEach(function (oneTxHash) {
            promises.push(web3.eth.getTransactionReceiptMined(oneTxHash, interval));
        });
        return Promise.all(promises);
    } else {
        return new Promise(function (resolve, reject) {
            transactionReceiptAsync(txnHash, resolve, reject);
        });
    }
};

///////////////
/// TestRPC ///
///////////////
const testRpc = {};

testRpc.asyncSend = function asyncSend(method, params) {
    if (params && !Array.isArray(params)) params = [params];
    return new Promise((resolve, reject) => {
        web3.currentProvider.sendAsync({
            jsonrpc: "2.0",
            method: method,
            params: params ? params : [],
            id: new Date().getTime()
        }, (err, res) => {
            if (err) return reject(err);
            if (typeof res.error === 'object' && res.error.message) return reject(Error(res.error.message));
            resolve(res);
        });
    });
};

testRpc.snapshot = function snapshot() {
    return testRpc.asyncSend('evm_snapshot').then(res => res.result);
};

testRpc.revert = function revert(id) {
    console.log('id', id);
   return testRpc.asyncSend('evm_revert', id);
};

testRpc.mineBlock = function() {
    return testRpc.asyncSend('evm_mine');
};

testRpc.increaseTime = function(secondsToJump) {
    return testRpc.asyncSend('evm_increaseTime', secondsToJump);
};

testRpc.resetTime = function() {
    return testRpc.asyncSend('evm_setTime', new Date().toString());
};

module.exports.testRpc = testRpc;
