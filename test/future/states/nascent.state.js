'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:flightfuture.nascent');
const utils = require('../lib/utils');
const constants = require('../lib/constants');

const FlightFuture = artifacts.require('./FlightFuture');

contract('FlightFuture.Nascent', (accounts) => {
    let future;

    it('should not allow contract creation if the accept fee is not provided or is 0', (done) => {
        Promise.coroutine(function* () {
            try {
                future = yield FlightFuture.new();
                assert.isNotOk(future, 'Expected a the contract deployment to fail');
            } catch(err) {
                if (err.name === constants.ERRORS.assertion.name) throw err;
                assert.isOk(err, 'Expected the contract deployment to have errors.');
            }

            try {
                future = yield FlightFuture.new(0);
                assert.isNotOk(future, 'Expected a the contract deployment to fail');
            } catch(err) {
                if (err.name === constants.ERRORS.assertion.name) throw err;
                assert.isOk(err, 'Expected the contract deployment to have errors.');
            }

            return done();
        })().catch(done);
    });

    it('should allow creation of contract with valid creation params', (done) => {
        Promise.coroutine(function* () {
            future = yield FlightFuture.new([constants.DEFAULTS.ACCEPT_FEE]);
            assert.isOk(future, 'Expected a contract to be returned after deployed');

            return done();
        })().catch(done);
    });

    it('should be in the Nascent state after deployment', (done) => {
        Promise.coroutine(function* () {
            const state = yield future.getState();
            assert.equal(state, constants.STATES.NASCENT, `Expected the contract to have state set to ${constants.STATES.NASCENT} after deployment.`);

            return done();
        })().catch(done);
    });

    it('should correctly set the owner of the contract after deployment', (done) => {
        Promise.coroutine(function* () {
            const owner = yield future.owner();
            assert.equal(owner, accounts[0], 'Expected the owner state variable to be accounts[0]');

            return done();
        })().catch(done);
    });

    // checks for accuracy within 1 day
    it('should correctly set the creation_date of the contract after deployment', (done) => {
        Promise.coroutine(function* () {
            const creation_timestamp = yield future.creation_timestamp();
            const creation_date = utils.createDateString(new Date(Number(creation_timestamp * 1000)));
            const now = utils.createDateString(new Date());
            assert.equal(now, creation_date, 'Expected the creation date to be today.');

            return done();
        })().catch(done);
    });
});

