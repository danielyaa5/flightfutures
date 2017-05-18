'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:dao');
const utils = require('../lib/utils');
const constants = require('../lib/constants');

const Dao = artifacts.require('./Dao');
const web3 = utils.web3;

contract('DAO', (accounts) => {
  let dao;

  const owner_account = accounts[0];

  const buyer_address = accounts[1];
  const flight_info = 'LAX+CDG+10/21/2017';
  const sell_price = 600;
  const target_price = 400;
  const contract_length = 60;
  const mark_to_market_rate = 1 * 24;
  const seller_email = 'danielyaa5@gmail.com';
  const default_valid  = [
      buyer_address, flight_info, sell_price, target_price, contract_length, mark_to_market_rate, seller_email
  ];

  it('should be able to create a valid new FlightFuture', (done) => {
    Promise.coroutine(function*() {
      dao = yield Dao.deployed();
      yield dao.newFlightFuture.apply(this, default_valid);

      return done();
    })().catch(done);
  });
  it('should store the new FlightFuture contract in state map');
  it('should emit NewFlightFutureEvent upon creation');
  it('should throw when request tx is not made from a FlightFuture contract');
  it('should add valid request when request tx is made');
  it('should add a valid request when request tx is made');
  it('should call the request callback with result value upon response');
  it('should wait before making query if timeout specified');
  it('should throw if the response for the same query_id was already made');
});
