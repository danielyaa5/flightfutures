'use strict';

const fs = require('fs');
const solc = require('solc');
const ck = require('chronokinesis');
const TestRPC = require("ethereumjs-testrpc");
const Web3 = require('web3');

const provider = TestRPC.provider();
const web3 = new Web3(provider);
const FlightFuture = artifacts.require('./FlightFuture');

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));

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
const gas_estimate = web3.eth.estimateGas({data: bytecode});

const nascent = function purchased(accounts) {
    describe('Nascent', () => {

    });
};

const offered = function offered(accounts) {
    describe('Offered', () => {
        const valid_test_contract_params = [
            1493535600000,          // epoch depart date
            '04/30/2017',           // depart date
            'LAX',                  // depart location
            'CDG',                  // destination location
            web3.toWei(0.1),         // sell price wei
            600,                    // target price primary
            10,                     // penalty price wei
            42,                     // contract length (days)
            'owner@foobar.com',     // owner email
            'public_key'            // public key
        ];


        it('should allow creation of contract with valid params', () => {
            let future;
            const transaction_options = { from: accounts[2], gas: gas_estimate, value: web3.toWei(0.1) };
            return FlightFuture.deployed()
            .then((instance) => {
                future = instance;
                return future.offer.apply(this, valid_test_contract_params.concat(transaction_options))
            })
            .then(() => {
            })
            .catch((err) => {
                console.log('ERROR');
                console.log(err);
                assert.isNotOk(err, 'Expected the contract to be created successfully.');
            });
        });

        it('should have a contract balance equal to the payment penalty', () => {

        });

        it('should have a state set to Offered after offer has been called', () => {

        });
        //
        // it('should not allow creation of contract unless payment sent is equal to the penalty price param', () => {
        //
        //     // try creating contract with value less than penalty price
        //     let transaction_options = { from: accounts[1], gas: gas_estimate, value: 9 };
        //     return FlightFuture.new.apply(this, valid_test_contract_params.concat(transaction_options))
        //     .then((instance) => {
        //         assert.isNotOk(instance, 'The contract was successfully created, was expecting it to fail.')
        //     })
        //     .catch((err) => {
        //         assert.isOk(err && err.message, 'Expecting error message but none was found');
        //         assert(err.message.includes('invalid JUMP'), 'Not the ');
        //     })
        //     .then(() => {
        //         // try creating contract with value to high
        //         const transaction_options = { from: accounts[1], gas: gas_estimate, value: 11 };
        //         return FlightFuture.new.apply(this, valid_test_contract_params.concat(transaction_options));
        //     })
        //     .then((instance) => {
        //         assert.isNotOk(instance, 'The contract with more value than penalty was successfully created.')
        //     })
        //     .catch((err) => {
        //         assert.isOk(err && err.message, 'Contract with more value than penalty has no error.');
        //         assert(err.message.includes('invalid JUMP'), 'Not the correct error message.');
        //     })
        //     .then(() => {
        //         // try creating contract with no value
        //         const transaction_options = { from: accounts[1], gas: gas_estimate };
        //         return FlightFuture.new.apply(this, valid_test_contract_params.concat(transaction_options));
        //     })
        //     .then((instance) => {
        //         assert.isNotOk(instance, 'The contract with no value was successfully created.')
        //     })
        //     .catch((err) => {
        //         assert.isOk(err && err.message, 'Contract with no value has no error.');
        //         assert(err.message.includes('invalid JUMP'), 'Not the correct error message.');
        //     })
        //     .then(() => {
        //         // try creating contract with 0 value
        //         const transaction_options = { from: accounts[1], gas: gas_estimate, value: 0 };
        //         return FlightFuture.new.apply(this, valid_test_contract_params.concat(transaction_options));
        //     })
        //     .then((instance) => {
        //         assert.isOk(instance, 'The contract with 0 value was successfully created.')
        //     })
        //     .catch((err) => {
        //         assert.isOk(err && err.message, 'Contract with 0 value has no error.');
        //         console.log(err.message);
        //         assert(err.message.includes('invalid JUMP'), 'Not the correct error message.');
        //     });
        // });
        //
        // it('should have a contract balance equal to the penalty price param', () => {
        //     const transaction_options = { from: accounts[1], gas: gas_estimate, value: web3.toWei(4) };
        //     return FlightFuture.new.apply(this, valid_test_contract_params.concat(transaction_options))
        //         .then((instance) => {
        //             assert.isOk(instance, 'The contract was not created successfully.');
        //             console.log(instance);
        //             const penalty = valid_test_contract_params[6];
        //             const balance = web3.eth.getBalance(FlightFuture);
        //             assert.equal(balance, penalty, 'The balance of the contract does not equal the penalty price');
        //         })
        //         .catch((err) => {
        //             console.log('ERROR');
        //             console.log(err);
        //             assert.isNotOk(err, 'Expected the contract to be created successfully.');
        //         });
        // });

        it('should correctly set the correct conversion rate upon creation', () => {

        });

        it('should correctly set the prices struct (sell_price, target_price, penalty_price)', () => {

        });

        it('should correctly set the flightInfo struct (depart_date, depart_location)', () => {

        });

        it('should correctly set the owner address to the msg.sender', () => {

        });

        it('should correctly set the contact information of the contract owner', () => {

        });

        it('should correctly set the pub_key', () => {

        });

        it('should fire the OfferedEvent with correct values', () => {

        });
    });
};

const purchased = function purchased(accounts) {
    describe('Purchased', () => {

    });
};

const marked = function marked(accounts) {
    describe('Marked', () => {

    });
};

const balanceVerified = function balanceVerified(accounts) {
    describe('BalanceVerified', () => {

    });
};

const buyingTicket = function buyingTicket(accounts) {
    describe('BuyingTicket', () => {

    });
};

const ticketPurchased = function offered(accounts) {
    describe('TicketPurchased', () => {

    });
};

const expired = function expired(accounts) {
    describe('Expired', () => {

    });
};

const defaulted = function defaulted(accounts) {
    describe('Defaulted', () => {

    });
};

contract('FlightFuture', (accounts) => {
    nascent(accounts);
    offered(accounts);
    purchased(accounts);
    marked(accounts);
    balanceVerified(accounts);
    buyingTicket(accounts);
    ticketPurchased(accounts);
    expired(accounts);
    defaulted(accounts);
});