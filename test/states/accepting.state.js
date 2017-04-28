'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:flightfuture.accepting');
const utils = require('../lib/utils');
const constants = require('../lib/constants');

const FlightFuture = artifacts.require('./FlightFuture');
const web3 = utils.web3;

contract('FlightFuture.Accepting', (accounts) => {
    let future;

    const owner_account = accounts[0];
    const seller_account = accounts[1];
    const buyer_account = accounts[2];

    // offer params
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

    const accept_payment = constants.DEFAULTS.ACCEPT_FEE + web3.toWei(0.001);
    const buyer_email = 'buyer@gmail.com';
    const valid_accept_params = [buyer_email];

    it('should not allow buyer to accept if the contract is not in the Offered state', (done) => {
        Promise.coroutine(function*() {
            future = yield FlightFuture.new([constants.DEFAULTS.ACCEPT_FEE], { from: owner_account });

            for(let i=0; i < constants.ALL_STATES.length; i++) {
                if (constants.ALL_STATES[i] === constants.STATES.OFFERED) continue;

                yield future.setState(i, { from: owner_account });

                const curr_state = yield future.getState();
                assert.equal(constants.ALL_STATES[i], curr_state.toString());

                try
                {
                    assert.equal(curr_state, constants.ALL_STATES[i], 'Current state of the contract should be equal to the state in the iteration');

                    const transaction_options = {from: buyer_account, value: accept_payment };
                    yield future.accept.apply(this, valid_accept_params.concat(transaction_options));

                    assert.equal(false, true, 'Expected the offer transaction to throw since we are not in the Offered state.');
                }
                catch (err)
                {
                    if (err.name === constants.ERRORS.assertion.name) throw err;

                    assert.isOk(err, 'Expected offer transaction to have a truthy error since we are not in the Offered state.');
                    assert(utils.isInvalidJumpErr(err), `Expected invalid jump error but got: \n ${err}`);
                }
            }

            return done();
        })().catch(done);
    });

    it('should not allow the accept transaction to complete with payments <= accept_fee', (done) => {
        Promise.coroutine(function* () {
            const invalid_payments = [undefined, 0, constants.DEFAULTS.ACCEPT_FEE,  constants.DEFAULTS.ACCEPT_FEE - 10];

            future = yield FlightFuture.new([constants.DEFAULTS.ACCEPT_FEE], { from: owner_account });

            const transaction_options = {from: seller_account, value: penalty_price};
            yield future.offer.apply(this, valid_offer_params.concat(transaction_options));

            for(let i = 0; i < invalid_payments.length; i++) {
                const invalid_payment = invalid_payments[i];
                try {
                    const transaction_options = {from: buyer_account, value: invalid_payment };
                    yield future.accept.apply(this, valid_accept_params.concat(transaction_options));

                    assert.equal(false, true, 'Expected the offer transaction to throw since we did not send payment equal to accept fee.');
                }
                catch (err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;

                    assert.isOk(err, 'Expected offer transaction to have a truthy error since we are not in the Offered state.');
                    assert(utils.isInvalidJumpErr(err), `Expected invalid jump error but got: \n ${err}`);
                }
            }

            return done();
        })().catch(done);
    });

    it('should not allow the user to accept contract if they are also the seller', (done) => {
        Promise.coroutine(function* () {
            yield future.setState(utils.getStateIndex(constants.STATES.OFFERED), { from: owner_account });

            const curr_state = yield future.getState();
            assert.equal(constants.STATES.OFFERED, curr_state.toString());

            try {
                const transaction_options = {from: seller_account, value: accept_payment };
                yield future.accept.apply(this, valid_accept_params.concat(transaction_options));

                assert.equal(false, true, 'Expected the offer transaction to throw since we are trying to accept from the seller account.');
            }
            catch (err) {
                if (err.name === constants.ERRORS.assertion.name) throw err;

                assert.isOk(err, 'Expected offer transaction to have a truthy error');
                assert(utils.isInvalidJumpErr(err), `Expected invalid jump error but got: \n ${err}`);
            }

            return done();
        })().catch(done);
    });

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

    it('should successfully complete an accept transaction if acceptable account and accept_payment > accept_fee', (done) => {
        Promise.coroutine(function*() {
            future = yield FlightFuture.new([constants.DEFAULTS.ACCEPT_FEE], { from: owner_account });

            const offer_transaction_options = {from: seller_account, value: penalty_price};
            yield future.offer.apply(this, valid_offer_params.concat(offer_transaction_options));

            const accept_transaction_options = {from: buyer_account, value: accept_payment};
            yield future.accept.apply(this, valid_accept_params.concat(accept_transaction_options));

            return done();
        })().catch(done);
    });
});

