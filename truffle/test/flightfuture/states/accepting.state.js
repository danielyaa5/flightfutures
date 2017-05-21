'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:Dao');

const utils = require('../../../lib/utils');
const constants = require('../../../lib/constants');
const oracleWorker = require('../../../../workers/oracle/oracleWorker');

const Dao = artifacts.require('./Dao');
const FlightFuture = artifacts.require('./FlightFuture');
const web3 = utils.web3;

const flight_info = 'LAX+CDG+10/21/2017';
const sell_price = 2;
const target_price = 1;
const contract_length_days = 60;
const mark_to_market_rate_hrs = 24;
const seller_email = 'danielyaa5@gmail.com';
const default_valid_offer  = [
    flight_info, sell_price, target_price, contract_length_days, mark_to_market_rate_hrs, seller_email
];
const buyer_email = 'foo@bar.com';
const accept_payment = 1; // Some value greater than 1, doesn't matter for these tests

contract('Accepting', (accounts) => {
    const owner_account = accounts[0];
    const seller_account = accounts[1];
    const buyer_account = accounts[2];

    it('should not allow buyer to accept if the contract is not in the Offered state', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);

            for(let i=0; i < constants.ALL_STATES.length; i++) {
                if (constants.ALL_STATES[i] === constants.STATES.OFFERED) continue;

                yield future.setState(i);

                const curr_state = yield future.getState();
                assert.equal(constants.ALL_STATES[i], curr_state.toString());

                let err;
                try
                {
                    const transaction_options = { from: buyer_account, value: accept_payment };
                    yield future.accept(buyer_email, transaction_options);
                }
                catch (e)
                {
                    err = e;
                }

                if (!err)
                    throw Error(`Expected accept tx to error since contract was not in Offered state, state = ${curr_state}`);
            }

            return done();
        })().catch(done);
    });

    it('should not allow buyer to accept the offer contract if their is no payment with tx', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);

            let err;
            try {
                yield future.accept(buyer_email, {from: buyer_account, value: 0});
            } catch (e) {
                err = e;
            }

            if(!err) throw Error('Expected an error to be thrown when accepting with payment value 0');

            return done();
        })().catch(done);
    });

    it('should not allow buyer to accept the offer contract if the buyer is also the seller', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);

            let err;
            try {
                yield future.accept(buyer_email, {from: seller_account, value: 1});
            } catch (e) {
                err = e;
            }

            if(!err) throw Error('Expected an error to be thrown when accepting with seller account');

            return done();
        })().catch(done);
    });

    // THIS TEST WILL NOT WORK UNTIL TEST RPC ALLOWS YOU TO RESET TIME ADJUSTMENTS, AWAITING PR MERGE

    // it('should not allow the user to accept contract if the current datetime is past the expiration', (done) => {
    //     Promise.coroutine(function* () {
    //         let snap;
    //         let err;
    //
    //         try {
    //             future = yield FlightFuture.new([constants.DEFAULTS.ACCEPT_FEE], {from: owner_account});
    //
    //             const offer_transaction_options = {from: seller_account, value: penalty_price};
    //             yield future.offer.apply(this, valid_offer_params.concat(offer_transaction_options));
    //
    //             yield utils.testRpc.increaseTime((contract_length + 1) * 24 * 60 * 60);
    //
    //             try {
    //                 const accept_transaction_options = {from: buyer_account, value: accept_payment};
    //                 yield future.accept.apply(this, valid_accept_params.concat(accept_transaction_options));
    //
    //                 assert.equal(false, true, 'Expected the offer transaction to throw since we are trying to accept from the seller account.');
    //             }
    //             catch (err) {
    //                 if (err.name === constants.ERRORS.assertion.name) throw err;
    //
    //                 assert.isOk(err, 'Expected offer transaction to have a truthy error');
    //                 assert(utils.isInvalidJumpErr(err), `Expected invalid jump error but got: \n ${err}`);
    //             }
    //         } catch (e) {
    //             err = e;
    //         }
    //
    //         yield utils.testRpc.resetTime();
    //         return done(err);
    //     })().catch(done);
    // });

    it('should be able to accept the new created contract', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);
            yield future.accept(buyer_email, { from: buyer_account, value: accept_payment });

            return done();
        })().catch(done);
    });

    it('should correctly set state variables after a successful accept tx', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);
            yield future.accept(buyer_email, { from: buyer_account, value: accept_payment });
            const future_owner = yield future.owner();
            const dao_owner = yield dao.owner();
            debug({ future_owner, dao_owner, owner_account, seller_account, buyer_account });

            const actual_buyer_email = yield future.buyer_email();
            const actual_accept_payment = yield future.accept_payment();
            const actual_buyer = yield future.buyer();

            const expected_buyer_email = buyer_email;
            const expected_accept_payment = accept_payment;
            const expected_buyer = buyer_account;

            assert.equal(actual_buyer_email, expected_buyer_email);
            assert.equal(actual_accept_payment, expected_accept_payment);
            assert.equal(actual_buyer, expected_buyer);

            return done();
        })().catch(done);
    });

    it('should change the state from Offered to Accepting after successful accept tx', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);
            const state = yield future.getState();
            yield future.accept(buyer_email, { from: buyer_account, value: accept_payment });
            const state_prime = yield future.getState();

            assert.equal(state, constants.STATES.OFFERED);
            assert.equal(state_prime, constants.STATES.ACCEPTING);

            return done();
        })().catch(done);
    });

    it.only('should add conversion request to the Dao contract', (done) => {
        Promise.coroutine(function*() {
            const dao = yield Dao.new();
            const requests_length = yield dao.getRequestsLength();
            const tx = yield dao.newFlightFuture.apply(this, default_valid_offer.concat({ from: seller_account }));
            const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
            const new_flight_future_address = new_flight_future_logs[0].args._contract;
            const future = FlightFuture.at(new_flight_future_address);
            yield future.accept(buyer_email, { from: buyer_account, value: accept_payment });
            const requests_length_prime = yield dao.getRequestsLength();
            assert.equal(requests_length, 0);
            assert.equal(requests_length_prime, 1);

            const request = yield dao.getRequest(0);
            const expected_url = yield future.conversion_feed_url();
            const expected_timestamp = 0;
            const expected_processed = false;
            assert.equal(request[0], expected_url);
            assert.equal(request[1], expected_timestamp);
            assert.equal(request[2], expected_processed);

            const worker = oracleWorker(dao.contract.address);
            yield Promise.delay(10 * 1000);
            worker.stop();

            return done();
        })().catch(done);
    })
});
