'use strict';

const fs = require('fs');
const solc = require('solc');
const ck = require('chronokinesis');
const TestRPC = require("ethereumjs-testrpc");
const Web3 = require('web3');
const Promise = require('bluebird');
const request = require('request-promise');

const provider = TestRPC.provider();
const web3 = new Web3(provider);
const FlightFuture = artifacts.require('./FlightFuture');

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));


const DEFAULT_GAS_LIMIT = 4712388;
const CONVERSION_URL = 'https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=ETH';
const ASSERTION_ERROR_NAME = 'AssertionError';
const States = {
    NASCENT: 'Nascent', OFFERED: 'Offered', PURCHASED: 'Purchased', MARKED: 'Marked',
    BALANCE_VERIFIED: 'BalanceVerified', BUYING_TICKET: 'BuyingTicket', TICKET_PURCHASED: 'TicketPurchased',
    EXPIRED: 'Expired', DEFAULTED: 'Defaulted'
};
const info = web3.eth.getBlock('latest');

console.log();
console.log('gasLimit:', info.gasLimit);
console.log('gasPrice:', web3.eth.gasPrice.toString(10));

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



const nascent = function purchased(accounts) {
    contract('Nascent', () => {
        let future;

        it('should allow creation of contract', (done) => {
            Promise.coroutine(function* () {
                try {
                    future = yield FlightFuture.deployed();
                    assert.isOk(future, 'Expected a contract to be returned after deployed');
                } catch(err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    console.log('ERROR');
                    console.error(err);
                    assert.isNotOk(err, 'Expected the contract to be deployed without errors.');
                }

                done();
            })();
        });

        it('should be in the Nascent state after deployment', (done) => {
            Promise.coroutine(function* () {
                try {
                    const state = yield future.getState();
                    assert.equal(state, States.NASCENT, `Expected the contract to have state set to ${States.NASCENT} after deployment.`);
                } catch(err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    console.log('ERROR');
                    console.error(err);
                    assert.isNotOk(err, 'Expected the contract to be deployed without errors.');
                }

                done();
            })();
        });

        it('should correctly set the owner of the contract after deployment', (done) => {
            Promise.coroutine(function* () {
                try {
                    const owner = yield future.owner();
                    assert.equal(owner, accounts[0], 'Expected the owner state variable to be accounts[0]');
                } catch(err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    console.log('ERROR');
                    console.error(err);
                    assert.isNotOk(err, 'Expected the contract to be deployed without errors.');
                }

                done();
            })();
        });

        // checks for accuracy within 1 day
        it('should correctly set the creation_date of the contract after deployment', (done) => {
            Promise.coroutine(function* () {
                try {
                    const creation_timestamp = yield future.creation_timestamp();
                    const creation_date = createDateString(new Date(Number(creation_timestamp * 1000)));
                    const now = createDateString(new Date());
                    assert.equal(now, creation_date, 'Expected the creation date to be today.');
                } catch(err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    console.log('ERROR');
                    console.error(err);
                    assert.isNotOk(err, 'Expected the contract to be deployed without errors.');
                }

                done();
            })();
        });
    });
};

const offered = function offered(accounts) {
    contract('Offered', () => {
        let future;
        const penalty_price = web3.toWei(0.1);
        const valid_offer_params = [
            1493535600000,          // epoch depart date
            '04/30/2017',           // depart date
            'LAX',                  // depart location
            'CDG',                  // destination location
            100,                    // sell price wei
            600,                    // target price primary
            penalty_price,          // penalty price wei
            42,                     // contract length (days)
            'owner@foobar.com',     // owner email
            'public_key'            // public key
        ];

        it('should not allow offer transaction if payment sent is not equal to the penalty price param', (done) => {
            Promise.coroutine(function* () {
                let transaction_options = { from: accounts[0], gas: DEFAULT_GAS_LIMIT, value: web3.toWei(0.09) };
                try {
                    future = yield FlightFuture.deployed();
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected transaction to fail when value sent is less than penalty price.');
                } catch(err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    assert.isOk(err, 'Expected the offer transaction to contain an error when value sent is less than penalty price.');
                }

                transaction_options = { from: accounts[0], gas: DEFAULT_GAS_LIMIT, value: web3.toWei(0.11) };
                try {
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected transaction to fail when value sent is more than penalty price.');
                } catch(err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    assert.isOk(err, 'Expected transaction to have error when value sent is more than penalty price.');
                }

                transaction_options = { from: accounts[0], gas: DEFAULT_GAS_LIMIT, value: 0 };
                try {
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected transaction to fail when value sent is 0.');
                } catch(err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    assert.isOk(err, 'Expected transaction to contain error when value sent is 0.');
                }

                transaction_options = { from: accounts[0], gas: DEFAULT_GAS_LIMIT };
                try {
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected transaction to fail when value to send is not specified.');
                } catch(err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    assert.isOk(err, 'Expected transaction to have error when value to send is not specified.');
                }

                done();
            })();
        });

        it ('should not be allowed to create the contract from a different account then the one that created the contract', (done) => {
            Promise.coroutine(function* () {

                // from account 2 instead of the 0 account which deployed the contract
                let transaction_options = { from: accounts[2], gas: DEFAULT_GAS_LIMIT, value: penalty_price };
                try {
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected transaction to fail when not coming from accounts[0]');
                } catch(err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    assert.isOk(err, 'Expected the offer transaction to contain an error when not coming from accounts[0].');
                }

                done();
            })();
        });

        it('should allow contract to be offered if payment equals penalty price and params are valid', (done) => {
            Promise.coroutine(function* () {
                let transaction_options = {from: accounts[0], gas: DEFAULT_GAS_LIMIT, value: penalty_price};
                try {
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                } catch (err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    console.error(err);
                    assert.isNotOk(err, 'Expected the offer transaction to be successful');
                }

                done();
            })();
        });

        it('should have a contract balance equal to the payment penalty minus cost of oraclize query', (done) => {
            Promise.coroutine(function* () {
                try {
                    const balance = web3.eth.getBalance(future.address).toNumber();
                    assert.equal(penalty_price, balance, 'Expected the balance of the contract to be equal to the penalty price');
                } catch (err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    console.error(err);
                    assert.isNotOk(err, 'Expected the offer transaction to be successful');
                }

                done();
            })();
        });

        it('should have a state set to Offered after offer transaction has been made', (done) => {
            Promise.coroutine(function* () {
                try {
                    const state = yield future.getState();
                    assert.equal(state, States.OFFERED, 'Expected the state to be Offered.')
                } catch (err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    console.error(err);
                    assert.isNotOk(err, 'Expected the getState call to be successful');
                }

                done();
            })();
        });

        it('should not be allowed to complete an offer transaction if the contract is already in the offered state', (done) => {
            Promise.coroutine(function* () {
                const transaction_options = {from: accounts[0], gas: DEFAULT_GAS_LIMIT, value: penalty_price};
                try {
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected the offer transaction to throw since we are already in the Offered state.');
                } catch (err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    assert.isOk(err, 'Expect offer transaction to have a truthy error since we are already in the Offered state.')
                }

                done();
            })();
        });

        it('should correctly set the correct conversion rate upon creation', (done) => {
            Promise.coroutine(function* () {
                const transaction_options = {from: accounts[0], gas: DEFAULT_GAS_LIMIT, value: penalty_price};
                try {
                    // const events = future.allEvents((err, event) => {
                    //     if (err) return console.error(err);
                    //     return console.log(event);
                    // });
                    // events.stopWatching();

                    future = yield FlightFuture.new();
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    yield Promise.delay(12000);

                    let expected_conversion_rate = yield request(CONVERSION_URL);
                    expected_conversion_rate = JSON.parse(expected_conversion_rate).ETH;
                    expected_conversion_rate = web3.toWei(expected_conversion_rate);

                    yield Promise.delay(12000);

                    const conversion_rate = yield future.conversion_rate();
                    const acceptable_difference = web3.toWei(0.0001); // to account for difference in expected vs actual query times
                    const difference = Math.abs(conversion_rate - expected_conversion_rate);
                    assert(difference <= acceptable_difference, 'The difference between actual and expected queries is to high');

                } catch (err) {
                    if (err.name === ASSERTION_ERROR_NAME) throw err;
                    assert.isNotOk(err, 'Expected the conversion_rate call to succeed');
                }

                done();
            })();
        });

        it('should fire the stateChanged event', () => {});

        it('should fire the offered event', () => {});

        it('should fire the oraclizeCb event', () => {});

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
    contract('Purchased', () => {

    });
};

const marked = function marked(accounts) {
    contract('Marked', () => {

    });
};

const balanceVerified = function balanceVerified(accounts) {
    contract('BalanceVerified', () => {

    });
};

const buyingTicket = function buyingTicket(accounts) {
    contract('BuyingTicket', () => {

    });
};

const ticketPurchased = function offered(accounts) {
    contract('TicketPurchased', () => {

    });
};

const expired = function expired(accounts) {
    contract('Expired', () => {

    });
};

const defaulted = function defaulted(accounts) {
    contract('Defaulted', () => {

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