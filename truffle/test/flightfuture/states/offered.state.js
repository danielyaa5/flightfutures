'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:Future.offered');

const utils = require('../../../future-lib/utils');
const constants = require('../../../future-lib/constants');

const Future = artifacts.require('./Future');
const web3 = utils.web3;

let future;

contract('Offered', (accounts) => {
    const owner = accounts[0];
    const dao_address = accounts[1];
    const seller_address = accounts[2];
    const dao_owner = owner;
    const sell_price = 100;
    const target_price = 600;
    const contract_length_days = 42;
    const mark_to_market_rate_secs = 24;
    const seller_email = 'seller@foobar.com';
    const price_feed_url = 'http://price-feed-example.com';
    const conversion_feed_url = 'http://conversion-feed-example.com';
    const valid_offer_params = new Map([
        ['dao_address', dao_address],
        ['seller_address', seller_address],
        ['dao_owner', dao_owner],
        ['sell_price', sell_price],
        ['target_price', target_price],
        ['contract_length_days', contract_length_days],
        ['mark_to_market_rate_secs', mark_to_market_rate_secs],
        ['seller_email', seller_email],
        ['price_feed_url', price_feed_url],
        ['conversion_feed_url', conversion_feed_url]
    ]);
    const getValidOfferParamsArr = () => Array.from(valid_offer_params.values());

    it('should not be allowed to complete an offer transaction if the contract is not in the Nascent state', (done) => {
        Promise.coroutine(function*() {
            future = yield Future.new();

            for(let i=0; i < constants.ALL_STATES.length; i++) {
                if (constants.ALL_STATES[i] === constants.STATES.NASCENT) continue;

                debug(`Setting Future contract state to state ${i}, aka ${constants.ALL_STATES[i]}`);
                yield future.setState(i);
                const curr_state = yield future.getState();

                assert.equal(constants.ALL_STATES[i], curr_state.toString());

                let err;
                try
                {
                    yield future.offer.apply(this, getValidOfferParamsArr());
                }
                catch (e)
                {
                    err = e;
                }

                if (!err) throw Error('Expected offer tx to fail since the' +
                                        `state of the contract was not Nascent, state = ${curr_state}`);
            }

            return done();
        })().catch(done);
    });

    it('should allow contract to be offered', (done) => {
        Promise.coroutine(function*() {
            future = yield Future.new();
            yield future.offer.apply(this, getValidOfferParamsArr());

            return done();
        })().catch(done);
    });

    it('offer tx params should be used to properly set state variables', (done) => {
        Promise.coroutine(function*() {
            future = yield Future.new();
            yield future.offer.apply(this, getValidOfferParamsArr());

            const actual_dao_address = yield future.DaoContract();
            const actual_seller_address = yield future.seller();
            const actual_sell_price = yield future.sell_price();
            const actual_target_price = yield future.target_price();
            const actual_contract_length = yield future.contract_length();
            const actual_mark_to_market_rate = yield future.mark_to_market_rate_secs();
            const actual_seller_email = yield future.seller_email();
            const actual_price_feed_url = yield future.price_feed_url();
            const actual_conversion_feed_url = yield future.conversion_feed_url();

            const expected_dao_address = valid_offer_params.get('dao_address');
            const expected_seller_address = valid_offer_params.get('seller_address');
            const expected_sell_price = valid_offer_params.get('sell_price');
            const expected_target_price = valid_offer_params.get('target_price');
            const expected_contract_length = valid_offer_params.get('contract_length_days');
            const expected_mark_to_market_rate = valid_offer_params.get('mark_to_market_rate_secs');
            const expected_seller_email = valid_offer_params.get('seller_email');
            const expected_price_feed_url = valid_offer_params.get('price_feed_url');
            const expected_conversion_feed_url = valid_offer_params.get('conversion_feed_url');

            // assertions
            assert.equal(actual_dao_address, expected_dao_address);
            assert.equal(actual_seller_address, expected_seller_address);
            assert.equal(actual_sell_price, expected_sell_price);
            assert.equal(actual_target_price, expected_target_price);
            assert.equal(actual_contract_length, expected_contract_length);
            assert.equal(actual_mark_to_market_rate, expected_mark_to_market_rate);
            assert.equal(actual_seller_email, expected_seller_email);
            assert.equal(actual_price_feed_url, expected_price_feed_url);
            assert.equal(actual_conversion_feed_url, expected_conversion_feed_url);

            return done();
        })().catch(done);
    });

    it('should have a state set to Offered after offer transaction has been made', (done) => {
        Promise.coroutine(function*() {
            future = yield Future.new();
            yield future.offer.apply(this, getValidOfferParamsArr());
            const state = yield future.getState();
            assert.equal(state, constants.STATES.OFFERED, 'Expected the state to be Offered.');

            return done();
        })().catch(done);
    });

    it('should fire the StateChangedEvent with correct prev state and new state after successful offer', (done) => {
        Promise.coroutine(function*() {
            future = yield Future.new();
            const tx = yield future.offer.apply(this, getValidOfferParamsArr());
            const logs = tx.logs;
            const log = logs.find(log => log.event === constants.EVENTS.STATE_CHANGED);
            if (log) {
                assert.equal(log.args._prev_state, constants.STATES.NASCENT, 'Expected prev_state to the Nascent state');
                assert.equal(log.args._new_state, constants.STATES.OFFERED, 'Expected the new state to be Offered');
                return done();
            }

            return done(Error(`The StateChangedEvent was not received`));
        })().catch(done);
    });

    it('should correctly set the expiration timestamp to now + contract_length', (done) => {
        Promise.coroutine(function*() {
            future = yield Future.new();
            yield future.offer.apply(this, getValidOfferParamsArr());
            const acceptable_accuracy = 0.0000001;
            const actual_expiration = Number((yield future.expiration()).toString()); // seconds
            const expected_expiration = Math.round(new Date().getTime() / 1000) + valid_offer_params.get('contract_length_days') * 24 * 60 * 60;
            assert.isAtMost(utils.percentDiff(actual_expiration, expected_expiration), acceptable_accuracy, 'The recorded expiration was not as expected');

            return done();
        })().catch(done);
    });
});
