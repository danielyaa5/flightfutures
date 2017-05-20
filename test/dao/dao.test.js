'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:Dao');
const utils = require('../lib/utils');
const constants = require('../lib/constants');

const Dao = artifacts.require('./Dao');
const web3 = utils.web3;

let dao;
let new_flight_future_address;

const flight_info = 'LAX+CDG+10/21/2017';
const sell_price = 600;
const target_price = 400;
const contract_length = 60;
const mark_to_market_rate = 1 * 24;
const seller_email = 'danielyaa5@gmail.com';
const default_valid  = [
    flight_info, sell_price, target_price, contract_length, mark_to_market_rate, seller_email
];

contract('DAO', (accounts) => {
    const owner_account = accounts[0];
    const seller_account = accounts[1];

   describe('newFlightFuture', () => {
        it('should be able to create a new FlightFuture contract', (done) => {
            Promise.coroutine(function*() {
                dao = yield Dao.deployed();
                const tx = yield dao.newFlightFuture.apply(this, default_valid);
                const new_flight_future_logs = tx.logs.filter(log => log.event === 'NewFlightFutureEvent');
                new_flight_future_address = new_flight_future_logs[0].args._contract;
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

                return done();
            })().catch(done);
        });
   });
});
