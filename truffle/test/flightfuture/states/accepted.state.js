'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:Dao');

const utils = require('../../../future-lib/utils');
const constants = require('../../../future-lib/constants');
const oracleWorker = require('../../../../workers/oracle/oracleWorker');

const Dao = artifacts.require('./Dao');
const FlightFuture = artifacts.require('./FlightFuture');
const web3 = utils.web3;

const flight_info = 'LAX+CDG+10-21-2017';
const sell_price = 2;
const target_price = 1;
const contract_length_days = 60;
const mark_to_market_rate_secs = 24;
const seller_email = 'danielyaa5@gmail.com';
const default_valid_offer  = [
    flight_info, sell_price, target_price, contract_length_days, mark_to_market_rate_secs, seller_email
];
const buyer_email = 'foo@bar.com';

contract('FlightFuture.Accepted', (accounts) => {
    const owner_account = accounts[0];
    const seller_account = accounts[1];
    const buyer_account = accounts[2];
    const other_account = accounts[3];

    it('should return to the offered state if the payment sent is less than sell price, with expected state variables reset', (done) => {
        Promise.coroutine(function*() {
            const accept_payment = 9;
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);
            yield future.accept(buyer_email, { from: buyer_account, value: accept_payment });

            // run worker to respond to oracle requests
            const worker = oracleWorker(dao.contract.address);
            yield Promise.delay(3 * 1000);
            worker.stop();

            const actual_curr_state = yield future.getState();
            const actual_buyer = parseInt((yield future.buyer()));
            const actual_buyer_balance = yield future.payments(buyer_account);
            const actual_buyer_email = yield future.buyer_email();
            debug(`Conversion rate: ${(yield future.conversion_rate())}`);

            const expected_curr_state = constants.STATES.OFFERED;
            const expected_buyer = '0';
            const expected_buyer_balance = accept_payment;
            const expected_buyer_email = '';

            assert.equal(actual_curr_state, expected_curr_state);
            assert.equal(actual_buyer, expected_buyer);
            assert.equal(actual_buyer_balance, expected_buyer_balance);
            assert.equal(actual_buyer_email, expected_buyer_email);

            return done();
        })().catch(done);
    });

    it('should not allow cancelAccept to be called from anyone other than the buyer', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);

            let err = null;
            try {
                yield future.setState(constants.helpers.getStateIndex(constants.STATES.ACCEPTING), {from: owner_account});

                const curr_state = yield future.getState();
                assert.equal(curr_state, constants.STATES.ACCEPTING);

                yield future.cancelAccept({ from: owner_account });
            } catch (e) {
                err = e;
            }
            assert.isTrue(utils.isInvalidOpcodeErr(err), 'Expected an invalid opcode error but got' + err.toString());
            err = null;

            try {
                yield future.setState(constants.helpers.getStateIndex(constants.STATES.ACCEPTING), {from: owner_account});

                const curr_state = yield future.getState();
                assert.equal(curr_state, constants.STATES.ACCEPTING);

                yield future.cancelAccept({ from: seller_account });
            } catch (e) {
                err = e;
            }
            assert.isTrue(utils.isInvalidOpcodeErr(err), 'Expected an invalid opcode error but got' + err.toString());

            return done();
        })().catch(done);
    });

    it('should fail on cancelAccept tx if state is not accepting', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);

            for(let i=0; i < constants.ALL_STATES.length; i++) {
                if (constants.ALL_STATES[i] === constants.STATES.ACCEPTING) continue;

                yield future.setState(i, {from: owner_account});
                const curr_state = yield future.getState();
                assert.equal(constants.ALL_STATES[i], curr_state.toString());

                let err = null;
                try
                {
                    assert.equal(curr_state, constants.ALL_STATES[i], 'Current state of the contract should be equal to the state in the iteration');

                    yield future.cancelAccept({ from: buyer_account });
                }
                catch (e)
                {
                    err = e;
                }
                assert.isTrue(utils.isInvalidOpcodeErr(err),
                    `Expected invalid job error when state is ${constants.ALL_STATES[i]}, but got: ${err}`);
            }

            return done();
        })().catch(done);
    });

    it('should fail on cancelAccept tx if sender is not buyer', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);
            yield future.setState(constants.helpers.getStateIndex(constants.STATES.ACCEPTING), {from: owner_account});

            const test_accounts = [owner_account, seller_account, other_account];
            for(let i = 0; i < test_accounts.length; i++) {
                let err = null;
                try {
                    yield future.cancelAccept({ from: test_accounts[i] });
                } catch (e) {
                    err = e;
                }
                assert.isTrue(utils.isInvalidOpcodeErr(err),
                    `Expected invalid job error when calling cancelAccept from test account #${i}, but got: ${err}`);
            }

            return done();
        })().catch(done);
    });

    it('should succeed with cancelAccept call while in the Accepting state, should reset state variables as expected', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);

            const accept_payment = 8;
            yield future.accept(buyer_email, { from: buyer_account, value: accept_payment });

            const curr_state = yield future.getState();
            assert.equal(curr_state, constants.STATES.ACCEPTING, 'state should be accepting after an accept tx');

            yield future.cancelAccept({ from: buyer_account });

            const actual_curr_state = yield future.getState();
            const actual_buyer = parseInt(yield future.buyer());
            const actual_buyer_balance = yield future.payments(buyer_account);
            const actual_buyer_email = yield future.buyer_email();

            const expected_curr_state = constants.STATES.OFFERED;
            const expected_buyer = '0';
            const expected_buyer_balance = accept_payment;
            const expected_buyer_email = '';

            assert.equal(actual_curr_state, expected_curr_state);
            assert.equal(actual_buyer, expected_buyer);
            assert.equal(actual_buyer_balance, expected_buyer_balance);
            assert.equal(actual_buyer_email, expected_buyer_email);

            return done();
        })().catch(done);
    });

    it('should set the conversion rate after successfully being accepted', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);
            yield future.accept(buyer_email, { from: buyer_account, value: web3.toWei(0.08) });

            // run worker to respond to oracle requests
            const worker = oracleWorker(dao.contract.address);
            yield Promise.delay(2 * 1000);
            worker.stop();

            /*
             Check conversion rate is correct. Note that since there is a time difference between oracle response and
             test check for conversion rate, there may be a small difference so check they are within an
             acceptable percentage instead of check to see that they are equal.
             */
            const actual_conversion_rate = (yield future.conversion_rate()).toNumber(); // US Cent to Wei
            const expected_conversion_rate = web3.toWei(JSON.parse(yield request(constants.CONVERSION_URL)).ETH)/100;
            const acceptable_percent_diff = 1;
            const actual_percent_diff = utils.percentDiff(actual_conversion_rate, expected_conversion_rate);
            debug({ actual_conversion_rate, expected_conversion_rate, actual_percent_diff });
            assert.isAtMost(actual_percent_diff, acceptable_percent_diff, 'The difference between actual and expected conversion rate is too high');

            return done();
        })().catch(done);
    });


    it('should move to accepted state after accept tx if payment is at least the sell price, should set state variables as expected', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);

            const expected_conversion_rate = web3.toWei(JSON.parse(yield request(constants.CONVERSION_URL)).ETH);
            const expected_required_accept_payment = expected_conversion_rate * sell_price;
            const accept_payment_buffer = 1 * expected_conversion_rate;
            const accept_payment = expected_required_accept_payment + accept_payment_buffer;
            yield future.accept(buyer_email, { from: buyer_account, value: accept_payment });

            // run worker to respond to oracle requests
            const worker = oracleWorker(dao.contract.address);
            yield Promise.delay(3 * 1000);
            worker.stop();

            const actual_conversion_rate = yield future.conversion_rate();
            const actual_curr_state = yield future.getState();
            const actual_buyer = yield future.buyer();
            const actual_buyer_balance = yield future.payments(buyer_account);
            const actual_buyer_email = yield future.buyer_email();

            const expected_curr_state_1 = constants.STATES.ACCEPTED;
            const expected_curr_state_2 = constants.STATES.MARKED;
            const expected_buyer = buyer_account;
            const expected_buyer_balance = accept_payment - (actual_conversion_rate * sell_price);
            const expected_buyer_email = buyer_email;

            assert.isTrue(actual_curr_state === expected_curr_state_1 || actual_curr_state === expected_curr_state_2);
            assert.equal(actual_buyer, expected_buyer);
            assert.equal(actual_buyer_balance, expected_buyer_balance);
            assert.equal(actual_buyer_email, expected_buyer_email);

            return done();
        })().catch(done);
    });

    it('should fail to move to the Accept state if the state is not Accepting when confirm accept is called', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);

            const expected_conversion_rate = web3.toWei(JSON.parse(yield request(constants.CONVERSION_URL)).ETH);
            const expected_required_accept_payment = expected_conversion_rate * sell_price;
            const accept_payment_buffer = 1 * expected_conversion_rate;
            const accept_payment = expected_required_accept_payment + accept_payment_buffer;
            yield future.accept(buyer_email, { from: buyer_account, value: accept_payment });

            for(let i=0; i < constants.ALL_STATES.length; i++) {
                if (constants.ALL_STATES[i] === constants.STATES.ACCEPTING) continue;

                yield future.setState(i);
                const curr_state = yield future.getState();
                assert.equal(constants.ALL_STATES[i], curr_state.toString());

                let err = null;
                try
                {
                    assert.equal(curr_state, constants.ALL_STATES[i], 'Current state of the contract should be equal to the state in the iteration');
                    yield future.confirmAccept();
                }
                catch (e)
                {
                    err = e;
                }
                assert.isTrue(utils.isInvalidAddressErr(err), `Expected invalid address error but got: ${err}`);
            }

            return done();
        })().catch(done);
    });
});

