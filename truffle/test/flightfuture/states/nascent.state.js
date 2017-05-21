'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:Future.nascent');
const utils = require('../../../lib/utils');
const constants = require('../../../lib/constants');

const Future = artifacts.require('./Future');

contract('Future.Nascent', (accounts) => {
    let future;

    it('should allow creation of contract', (done) => {
        Promise.coroutine(function* () {
            future = yield Future.new();
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

    it('should correctly set the creation_date of the contract after deployment', (done) => {
        Promise.coroutine(function* () {
            const creation_timestamp = yield future.creation_timestamp();
            const creation_date = utils.createDateString(new Date(creation_timestamp * 1000));
            const now = utils.createDateString(new Date());
            debug(`creation_timestamp ${new Date(creation_timestamp * 1000)}`);

            // checks for accuracy within 1 day
            assert.equal(now, creation_date, 'Expected the creation date to be today.');

            return done();
        })().catch(done);
    });
});

