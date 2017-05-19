'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:flightfuture.offered');

const utils = require('../lib/utils');
const constants = require('../lib/constants');

const FlightFuture = artifacts.require('./FlightFuture');
const web3 = utils.web3;

let future;
const depart_date = '04/30/2017';
const depart_location = 'LAX';
const destination_location = 'CDG';
const sell_price = 100;
const target_price = 600;
const penalty_price = web3.toWei(0.0001);
const contract_length = 42;
const seller_email = 'seller@foobar.com';
const valid_offer_params = [
    1493535600000,          // epoch depart date
    depart_date,            // depart date
    depart_location,        // depart location
    destination_location,   // destination location
    sell_price,             // sell price primary
    target_price,           // target price primary
    penalty_price,          // penalty price wei
    contract_length,        // contract length (days)
    seller_email            // seller email
];

contract('Offered', (accounts) => {
    it('should not allow offer transaction if payment sent is not equal to the penalty price param', (done) => {
        Promise.coroutine(function*() {
            let transaction_options = { from: accounts[1], value: web3.toWei(0.09) };
            try {
                future = yield FlightFuture.new([constants.DEFAULTS.ACCEPT_FEE]);
                yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                assert.equal(false, true, 'Expected transaction to fail when value sent is less than penalty price.');
            } catch(err) {
                if (err.name === constants.ERRORS.assertion.name) throw err;
                assert.isOk(err, 'Expected the offer transaction to contain an error when value sent is less than penalty price.');
            }

            transaction_options = { from: accounts[1], value: web3.toWei(0.11) };
            try {
                yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                assert.equal(false, true, 'Expected transaction to fail when value sent is more than penalty price.');
            } catch(err) {
                if (err.name === constants.ERRORS.assertion.name) throw err;
                assert.isOk(err, 'Expected transaction to have error when value sent is more than penalty price.');
            }

            transaction_options = { from: accounts[1], value: 0 };
            try {
                yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                assert.equal(false, true, 'Expected transaction to fail when value sent is 0.');
            } catch(err) {
                if (err.name === constants.ERRORS.assertion.name) throw err;
                assert.isOk(err, 'Expected transaction to contain error when value sent is 0.');
            }

            transaction_options = { from: accounts[1], gas: constants.DEFAULTS.GAS_LIMIT };
            try {
                yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                assert.equal(false, true, 'Expected transaction to fail when value to send is not specified.');
            } catch(err) {
                if (err.name === constants.ERRORS.assertion.name) throw err;
                assert.isOk(err, 'Expected transaction to have error when value to send is not specified.');
            }

            return done();
        })().catch(done);
    });

    it('should not be allowed to complete an offer transaction if the contract is not in the Nascent state', (done) => {
        Promise.coroutine(function*() {
            for(let i=0; i < constants.ALL_STATES.length; i++) {
                if (constants.ALL_STATES[i] === constants.STATES.NASCENT) continue;

                yield future.setState(i, {from: accounts[0]});

                const curr_state = yield future.getState();

                assert.equal(constants.ALL_STATES[i], curr_state.toString());
                try
                {
                    assert.equal(curr_state, constants.ALL_STATES[i], 'Current state of the contract should be equal to the state in the iteration');

                    const transaction_options = {from: accounts[1], value: penalty_price};
                    yield future.offer.apply(this, valid_offer_params.concat(transaction_options));
                    assert.equal(false, true, 'Expected the offer transaction to throw since we are not in the Offered state.');
                }
                catch (err)
                {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
                    assert.isOk(err, 'Expected offer transaction to have a truthy error since we are not in the Offered state.');
                }
            }

            return done();
        })().catch(done);
    });

    it('should allow contract to be offered if payment equals penalty price and params are valid', (done) => {
        Promise.coroutine(function*() {
            future = yield FlightFuture.new([constants.DEFAULTS.ACCEPT_FEE]);

            const transaction_options = {from: accounts[1], value: penalty_price};

            yield future.offer.apply(this, valid_offer_params.concat(transaction_options));

            return done();
        })().catch(done);
    });

    it('should have a contract balance equal to the payment penalty', (done) => {
        Promise.coroutine(function*() {
            future = yield FlightFuture.new([constants.DEFAULTS.ACCEPT_FEE]);

            const transaction_options = {from: accounts[1], value: penalty_price};
            yield future.offer.apply(this, valid_offer_params.concat(transaction_options));

            const getBalance = Promise.promisify(web3.eth.getBalance);
            const balance = (yield getBalance(future.address, undefined)).toNumber();

            assert.equal(penalty_price, balance, 'Expected the balance of the contract to be equal to the penalty price');

            return done();
        })().catch(done);
    });

    it('should have a state set to Offered after offer transaction has been made', (done) => {
        Promise.coroutine(function*() {
            const state = yield future.getState();
            assert.equal(state, constants.STATES.OFFERED, 'Expected the state to be Offered.');

            return done();
        })().catch(done);
    });

    it('should fire the StateChangedEvent with correct prev state and new state after successful offer', (done) => {
        Promise.coroutine(function*() {
            const event_to = 5*1000;
            const transaction_options = {from: accounts[1], value: penalty_price};

            future = yield FlightFuture.new([constants.DEFAULTS.ACCEPT_FEE]);

            const events = future.allEvents();
            events.get = Promise.promisify(events.get);

            yield future.offer.apply(this, valid_offer_params.concat(transaction_options));

            let logs = yield events.get();
            let log = logs.find(log => log.event === constants.EVENTS.STATE_CHANGED);
            if (log) {
                assert.equal(log.args._prev_state, constants.STATES.NASCENT, 'Expected prev_state to the Nascent state');
                assert.equal(log.args._new_state, constants.STATES.OFFERED, 'Expected the new state to be Offered');
                return done();
            }

            yield Promise.delay(event_to);

            logs = yield events.get();
            log = logs.find(log => log.event === constants.EVENTS.STATE_CHANGED);
            if (log) {
                assert.equal(log.args._prev_state, constants.STATES.NASCENT, 'Expected prev_state to the Nascent state');
                assert.equal(log.args._new_state, constants.STATES.OFFERED, 'Expected the new state to be Offered');
                return done();
            }

            return done(Error(`The StateChangedEvent was not received before ${event_to/1000}s`));
        })().catch(done);
    });

    it('should correctly set the prices struct (sell_price, target_price, penalty_price)', (done) => {
        Promise.coroutine(function*() {
            const prices = yield future.prices();
            const actual_sell_price = prices[0];
            const actual_target_price = prices[1];
            const actual_penalty_price = prices[2];
            assert.equal(actual_sell_price, sell_price);
            assert.equal(actual_target_price, target_price);
            assert.equal(actual_penalty_price, penalty_price);

            return done();
        })().catch(done);
    });

    it('should correctly set the flight info values (depart_date, depart_location, destination_location)', (done) => {
        Promise.coroutine(function*() {
            const actual_depart_date = yield future.depart_date();
            const actual_depart_location = yield future.depart_location();
            const actual_destination_location = yield future.destination_location();
            assert.equal(actual_depart_date, depart_date);
            assert.equal(actual_depart_location, depart_location);
            assert.equal(actual_destination_location, destination_location);

            return done();
        })().catch(done);
    });

    it('should correctly set the seller address to the msg.sender', (done) => {
        Promise.coroutine(function*() {
            const actual_seller = yield future.seller();
            assert.equal(actual_seller, accounts[1]);

            return done();
        })().catch(done);
    });

    it('should not be able to call getSellerContactInfo if not the owner or seller', (done) => {
        Promise.coroutine(function*() {
            let getSellerContactInfoErr = null;
            try {
                yield future.getSellerContactInfo.call(({from: accounts[3]}));
            } catch (e) {
                getSellerContactInfoErr = e;
            }

            if (!getSellerContactInfoErr) throw Error('Expected to fail when not seller or owner');

            return done();
        })().catch(done);
    });

    it('should not have seller_contact_information as a public variable', (done) => {
        Promise.coroutine(function*() {
            let seller_contact_informationErr = null;
            try {
                yield future.seller_contact_information();
            } catch (e) {
                seller_contact_informationErr = e;
            }

            if (!seller_contact_informationErr) {
                throw Error('Expected to fail since seller_contact_information is not a public variable');
            }

            return done();
        })().catch(done);
    });

    it('should correctly set the contact information of the contract seller', (done) => {
        Promise.coroutine(function*() {
            let getSellerContactInfoErr = null;
            let actual_seller_contact_info = null;
            try {
                actual_seller_contact_info = yield future.getSellerContactInfo.call();
            } catch (e) {
                getSellerContactInfoErr = e;
            }

            assert.isNotOk(getSellerContactInfoErr, `Expected to succeeded but instead got error: ${getSellerContactInfoErr}`);
            assert.equal(actual_seller_contact_info, seller_email, 'Expected seller contact info to be seller_email');

            return done();
        })().catch(done);
    });

    it('should correctly set the expiration timestamp to now + contract_length', (done) => {
        Promise.coroutine(function*() {
            const acceptable_accuracy = 0.0000001;

            const actual_expiration = Number((yield future.expiration()).toString()); // seconds

            const expected_expiration = Math.round(new Date().getTime() / 1000) + contract_length * 24 * 60 * 60;

            assert.isAtMost(utils.percentDiff(actual_expiration, expected_expiration), acceptable_accuracy, 'The recorded expiration was not as expected');

            return done();
        })().catch(done);
    });
});
