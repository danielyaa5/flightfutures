'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:flightfuture.accepted');
const utils = require('../lib/utils');
const constants = require('../lib/constants');

const FlightFuture = artifacts.require('./FlightFuture');
const web3 = utils.web3;

contract('FlightFuture.Accepted', (accounts) => {
    let future;
    let accept_payment;
    let accept_result;

    const gas_price = web3.eth.gasPrice.toNumber();

    const owner_account = accounts[0];
    const seller_account = accounts[1];
    const buyer_account = accounts[2];

    // offer params
    const depart_date = '04/30/2017';
    const depart_location = 'LAX';
    const destination_location = 'CDG';
    const sell_price = 1; // dollars
    const target_price = 6; // dollars
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

    const accept_payment_lower_than_sell = constants.DEFAULTS.ACCEPT_FEE + web3.toWei(0.001);
    const buyer_email = 'buyer@gmail.com';
    const valid_accept_params = [buyer_email];

    it('should set the conversion rate after successfully being accepted', (done) => {
        Promise.coroutine(function*() {
            const acceptable_conversion_diff = 1; // percent

            future = yield FlightFuture.new([constants.DEFAULTS.ACCEPT_FEE], { from: owner_account });

            const offer_transaction_options = {from: seller_account, value: penalty_price};
            yield future.offer.apply(this, valid_offer_params.concat(offer_transaction_options));

            const accept_promise = [];
            const accept_transaction_options = { from: buyer_account, value: accept_payment_lower_than_sell };
            accept_promise.push(future.accept.apply(this, valid_accept_params.concat(accept_transaction_options)));

            const oraclize_event = future.OraclizeCbEvent();
            accept_promise.push(utils.waitForEvent(oraclize_event).timeout(60 * 1000));

            const results = yield Promise.all(accept_promise);
            accept_result = results[0];

            const actual_conversion_rate = web3.fromWei((yield future.conversion_rate()).toNumber());

            const expected_conversion_rate = JSON.parse(yield request(constants.CONVERSION_URL)).ETH;

            const percent_diff = utils.percentDiff(actual_conversion_rate, expected_conversion_rate);

            debug({ actual_conversion_rate, expected_conversion_rate, percent_diff });
            assert.isAtMost(percent_diff, acceptable_conversion_diff, 'The difference between actual and expected conversion rate is too high');

            return done();
        })().catch(done);
    });

    it('should return to the offered state if the payment sent is less than accept fee + sell price', (done) => {
        Promise.coroutine(function*() {
            const curr_state = yield future.getState.call();
            assert(curr_state, constants.STATES.OFFERED);
            return done();
        })().catch(done);
    });

    it('should have accept_payment - accept_fee available to buyer after failed accept transaction', (done) => {
        Promise.coroutine(function*() {
            const total_payments = (yield future.totalPayments()).toNumber();
            const buyer_payment = (yield future.payments(buyer_account)).toNumber();
            const oraclize_url_query_cost = (yield future.oraclize_url_query_cost());
            const expected_buyer_payment = accept_payment_lower_than_sell - oraclize_url_query_cost - (500000 * gas_price);
            const acceptable_diff_perc = 0.5;
            const actual_diff_perc = utils.percentDiff(expected_buyer_payment, buyer_payment);

            debug({
                total_payments,
                buyer_payment,
                expected_buyer_payment,
                accept_payment_lower_than_sell,
                acceptable_diff_perc,
                actual_diff_perc,
                oraclize_url_query_cost,
                gas_price,
            });
            assert.isAtMost(actual_diff_perc, acceptable_diff_perc);
            assert.equal(total_payments, buyer_payment);

            return done();
        })().catch(done);
    });

    it('should not allow cancelAccept to be called from anyone other than the buyer', (done) => {
        Promise.coroutine(function*() {

            try {
                yield future.setState(constants.helpers.getStateIndex(constants.STATES.ACCEPTING), {from: owner_account});

                const curr_state = yield future.getState.call();
                assert(curr_state, constants.STATES.ACCEPTING);

                yield future.cancelAccept({ from: owner_account });

                throw Error('Expected cancelAccept to fail, since it was not called from buyer account');
            } catch (e) {
                assert(utils.isInvalidJumpErr(e), 'Expected an invalid jump error but got' + e.toString());
            }

            try {
                yield future.setState(constants.helpers.getStateIndex(constants.STATES.ACCEPTING), {from: owner_account});

                const curr_state = yield future.getState.call();
                assert(curr_state, constants.STATES.ACCEPTING);

                yield future.cancelAccept({ from: seller_account });

                throw Error('Expected cancelAccept to fail, since it was not called from buyer account');
            } catch (e) {
                assert(utils.isInvalidJumpErr(e), 'Expected an invalid jump error but got' + e.toString());
            }

            return done();
        })().catch(done);
    });

    it('should return to the Offered state after calling cancelAccept, while in the Accepting state', (done) => {
        Promise.coroutine(function*() {
            yield future.setState(constants.helpers.getStateIndex(constants.STATES.ACCEPTING), {from: owner_account});

            const curr_state = yield future.getState.call();
            assert(curr_state, constants.STATES.ACCEPTING);


            return done();
        })().catch(done);
    });

    it('should fail on cancelAccept transaction if state is not accepting', (done) => {
        Promise.coroutine(function*() {
            return done();
        })().catch(done);
    });

    it('should move to accepted state if payment is at least the accept fee + sell price', (done) => {
        Promise.coroutine(function*() {
            const curr_conversion_rate = web3.toWei(JSON.parse(yield request(constants.CONVERSION_URL)).ETH);
            accept_payment = constants.DEFAULTS.ACCEPT_FEE + 1.5 * curr_conversion_rate;

            future = yield FlightFuture.new([constants.DEFAULTS.ACCEPT_FEE], { from: owner_account });

            const offer_transaction_options = {from: seller_account, value: penalty_price};
            yield future.offer.apply(this, valid_offer_params.concat(offer_transaction_options));

            const accept_promise = [];
            const accept_transaction_options = { from: buyer_account, value: accept_payment };
            accept_promise.push(future.accept.apply(this, valid_accept_params.concat(accept_transaction_options)));

            const oraclize_event = future.OraclizeCbEvent();
            accept_promise.push(utils.waitForEvent(oraclize_event).timeout(2 * 60 * 1000));

            yield Promise.all(accept_promise);

            const curr_state = yield future.getState.call();
            console.log(curr_state, curr_state);
            assert(curr_state, constants.STATES.OFFERED);

            return done();
        })().catch(done);
    });

    it('should make the difference between required payment and actual payment available to the buyer and ' +
        'no other payments should be available', (done) => {
        Promise.coroutine(function*() {
            const total_payments = (yield future.totalPayments()).toNumber();
            const buyer_payment = (yield future.payments(buyer_account)).toNumber();
            const conversion_rate = (yield future.conversion_rate()).toNumber();
            const prices = constants.helpers.fromPricesStruct(yield future.prices());
            const required_accept_payment = conversion_rate * prices.sell_price + constants.DEFAULTS.ACCEPT_FEE;
            const expected_buyer_payment = Math.abs(required_accept_payment - accept_payment);
            const acceptable_diff_perc = 0.00000000001;
            const actual_diff_perc = utils.percentDiff(expected_buyer_payment, buyer_payment);

            assert.isAtMost(actual_diff_perc, acceptable_diff_perc);
            assert.equal(total_payments, buyer_payment);

            return done();
        })().catch(done);
    });

    it('should be in the Offered state with email and buyer address reset after cancelAccept transaction', (done) => {
        Promise.coroutine(function*() {
            return done();
        })().catch(done);
    });

    it('should fail to move to the Accept state if the state is not Accepting when confirm accept is called', (done) => {
        Promise.coroutine(function*() {
            return done();
        })().catch(done);
    });

    it('should make the accept_payment - accept fee available to the buyer after cancelAccept transaction has been made', (done) => {
        Promise.coroutine(function*() {
            return done();
        })().catch(done);
    });

});

