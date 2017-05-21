'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:Dao');
const utils = require('../lib/utils');
const constants = require('../lib/constants');

const Dao = artifacts.require('./Dao');
const FlightFuture = artifacts.require('./FlightFuture');
const web3 = utils.web3;

const flight_info = 'LAX+CDG+10/21/2017';
const sell_price = 600;
const target_price = 400;
const contract_length_days = 60;
const mark_to_market_rate_hrs = 24;
const seller_email = 'danielyaa5@gmail.com';
const default_valid  = [
    flight_info, sell_price, target_price, contract_length_days, mark_to_market_rate_hrs, seller_email
];

contract('DAO', (accounts) => {
    const owner_account = accounts[0];
    const seller_account = accounts[1];

   describe('newFlightFuture', () => {
        it('should be able to create a new FlightFuture contract', (done) => {
            Promise.coroutine(function*() {
                const dao = yield Dao.new();
                const tx = yield dao.newFlightFuture.apply(this, default_valid.concat({ from: seller_account }));
                const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
                const new_flight_future_address = new_flight_future_logs[0].args._contract;
                const is_allowed = yield dao.isAllowedAddress(new_flight_future_address);
                debug(`The new address was added to the AllowedAddressMap? ${is_allowed}`);
                debug(`newFlightFuture tx logs \n ${new_flight_future_logs}`);

                // assertions
                assert.equal(new_flight_future_logs.length, 1, 'Expect there to be only one new FlightFuture created');
                assert.notEqual(new_flight_future_address.length, 0, 'Expected the address not to be an empty string');
                assert.notEqual(Number(new_flight_future_address), 0, 'Expected the address not to be the zero address');
                assert(is_allowed === true, 'Expected the new address to be added to the AllowedAddressMap');

                return done();
            })().catch(done);
        });

        it('should have the correct info set on the new FlightFuture', (done) => {
            Promise.coroutine(function*() {
                const dao = yield Dao.new();
                const tx = yield dao.newFlightFuture.apply(this, default_valid.concat({ from: seller_account }));
                const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
                const new_flight_future_address = new_flight_future_logs[0].args._contract;
                const future = FlightFuture.at(new_flight_future_address);

                const actual_dao_owner = yield dao.owner();
                const actual_flight_future_owner = yield future.owner();
                const actual_flight_info = yield future.flight_info();
                const actual_dao_address = yield future.DaoContract();
                const actual_seller_address = yield future.seller();
                const actual_sell_price = yield future.sell_price();
                const actual_target_price = yield future.target_price();
                const actual_contract_length_days = yield future.contract_length();
                const actual_mark_to_market_rate_hrs = yield future.mark_to_market_rate();
                const actual_seller_email = yield future.seller_email();

                const expected_dao_owner = owner_account;
                const expected_flight_future_owner = owner_account;
                const expected_flight_info = flight_info;
                const expected_dao_address = dao.contract.address;
                const expected_seller_address = seller_account;
                const expected_sell_price = sell_price;
                const expected_target_price = target_price;
                const expected_contract_length_days = contract_length_days;
                const expected_mark_to_market_rate_hrs = mark_to_market_rate_hrs;
                const expected_seller_email = seller_email;

                // assertions
                assert.equal(actual_dao_owner, expected_dao_owner);
                assert.equal(actual_flight_future_owner, expected_flight_future_owner);
                assert.equal(actual_flight_info, expected_flight_info);
                assert.equal(actual_dao_address, expected_dao_address);
                assert.equal(actual_seller_address, expected_seller_address);
                assert.equal(actual_sell_price, expected_sell_price);
                assert.equal(actual_target_price, expected_target_price);
                assert.equal(actual_contract_length_days, expected_contract_length_days);
                assert.equal(actual_mark_to_market_rate_hrs, expected_mark_to_market_rate_hrs);
                assert.equal(actual_seller_email, expected_seller_email);

                return done();
            })().catch(done);
        });
   });
});
