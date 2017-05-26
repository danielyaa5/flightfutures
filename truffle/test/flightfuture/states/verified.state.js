'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:flightfuture.accepted');
const utils = require('../future-lib/utils');
const constants = require('../future-lib/constants');

const FlightFuture = artifacts.require('./FlightFuture');
const web3 = utils.web3;

contract('FlightFuture.Verified', (done) => {
    it('should throw if the state is not Accepted or Marked', (done) => {
        Promise.coroutine(function*() {
            return done();
        })().catch(done);
    });

    it('should transition to the verified state after markToMarket transaction while contract is in Accepted state', (done) => {
        Promise.coroutine(function*() {
            return done();
        })().catch(done);
    });

    // it('should transition to the Expired state if now >= expiration after markToMarket transaction', (done) => {
    //     Promise.coroutine(function*() {
    //         return done();
    //     })().catch(done);
    // });

    it('should transition to Defaulted state after markToMarket transaction if in Marked state and contract balance' +
        ' is less than expected balance ', (done) => {
        Promise.coroutine(function*() {
            return done();
        })().catch(done);
    });

    it('should transition to the Verified state after markToMarket transaction if in Marked state and it should ' +
        'make any excess funds available to the owner', (done) => {
        Promise.coroutine(function*() {
            return done();
        })().catch(done);
    });
});
