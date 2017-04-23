'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:flightfuture.purchased');
const constants = require('./constants');

const FlightFuture = artifacts.require('./FlightFuture');

const offered = function offered(accounts, web3) {
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

    contract('Offered', () => {
        it('should not allow offer transaction if payment sent is not equal to the penalty price param', (done) => {
            Promise.coroutine(function* () {
                let transaction_options = { from: accounts[0], gas: constants.DEFAULT_GAS_LIMIT, value: web3.toWei(0.09) };
                try {
                    future = yield FlightFuture.deployed();
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected transaction to fail when value sent is less than penalty price.');
                } catch(err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
                    assert.isOk(err, 'Expected the offer transaction to contain an error when value sent is less than penalty price.');
                }

                transaction_options = { from: accounts[0], gas: constants.DEFAULT_GAS_LIMIT, value: web3.toWei(0.11) };
                try {
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected transaction to fail when value sent is more than penalty price.');
                } catch(err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
                    assert.isOk(err, 'Expected transaction to have error when value sent is more than penalty price.');
                }

                transaction_options = { from: accounts[0], gas: constants.DEFAULT_GAS_LIMIT, value: 0 };
                try {
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected transaction to fail when value sent is 0.');
                } catch(err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
                    assert.isOk(err, 'Expected transaction to contain error when value sent is 0.');
                }

                transaction_options = { from: accounts[0], gas: constants.DEFAULT_GAS_LIMIT };
                try {
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected transaction to fail when value to send is not specified.');
                } catch(err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
                    assert.isOk(err, 'Expected transaction to have error when value to send is not specified.');
                }

                done();
            })();
        });

        it ('should not be allowed to create the contract from a different account then the one that created the contract', (done) => {
            Promise.coroutine(function* () {

                // from account 2 instead of the 0 account which deployed the contract
                let transaction_options = { from: accounts[2], gas: constants.DEFAULT_GAS_LIMIT, value: penalty_price };
                try {
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected transaction to fail when not coming from accounts[0]');
                } catch(err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
                    assert.isOk(err, 'Expected the offer transaction to contain an error when not coming from accounts[0].');
                }

                done();
            })();
        });

        it('should allow contract to be offered if payment equals penalty price and params are valid', (done) => {
            Promise.coroutine(function* () {
                let transaction_options = {from: accounts[0], gas: constants.DEFAULT_GAS_LIMIT, value: penalty_price};
                try {
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                } catch (err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
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
                    if (err.name === constants.ERRORS.assertion.name) throw err;
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
                    assert.equal(state, STATES.OFFERED, 'Expected the state to be Offered.')
                } catch (err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
                    console.error(err);
                    assert.isNotOk(err, 'Expected the getState call to be successful');
                }

                done();
            })();
        });

        it('should not be allowed to complete an offer transaction if the contract is already in the offered state', (done) => {
            Promise.coroutine(function* () {
                const transaction_options = {from: accounts[0], gas: constants.DEFAULT_GAS_LIMIT, value: penalty_price};
                try {
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected the offer transaction to throw since we are already in the Offered state.');
                } catch (err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
                    assert.isOk(err, 'Expect offer transaction to have a truthy error since we are already in the Offered state.')
                }

                done();
            })();
        });

        it('should correctly set the correct conversion rate upon creation', (done) => {
            Promise.coroutine(function* () {
                let conversion_rate = null;
                let expected_conversion_rate = null;
                let acceptable_difference = null;
                let difference = null;
                const transaction_options = {from: accounts[0], gas: constants.DEFAULT_GAS_LIMIT, value: penalty_price};

                try {
                    // const events = future.allEvents((err, event) => {
                    //     if (err) return console.error(err);
                    //     return console.log(event);
                    // });
                    // events.stopWatching();

                    future = yield FlightFuture.new();

                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    yield Promise.delay(12000);

                    expected_conversion_rate = yield request(constants.CONVERSION_URL);
                    expected_conversion_rate = JSON.parse(expected_conversion_rate).ETH;
                    expected_conversion_rate = web3.toWei(expected_conversion_rate);

                    yield Promise.delay(12000);

                    conversion_rate = yield future.conversion_rate();
                    acceptable_difference = web3.toWei(0.0005); // to account for difference in expected vs actual query times
                    difference = Math.abs(conversion_rate - expected_conversion_rate);
                    assert(difference < acceptable_difference, 'The difference between actual and expected queries is to high');

                } catch (err) {
                    if (err.name === constants.ERRORS.assertion.name) {
                        console.log({ conversion_rate, expected_conversion_rate, acceptable_difference, difference })
                        throw err;
                    }
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
