'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:flightfuture.purchased');
const constants = require('./constants');

const FlightFuture = artifacts.require('./FlightFuture');

const nascent = function nascent(web3) {
    contract('Nascent', (accounts) => {
        let future;

        it('should allow creation of contract', (done) => {
            Promise.coroutine(function* () {
                try {
                    future = yield FlightFuture.deployed();
                    assert.isOk(future, 'Expected a contract to be returned after deployed');
                } catch(err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
                    console.log('ERROR');
                    console.error(err);
                    assert.isNotOk(err, 'Expected the contract to be deployed without errors.');
                }

                done();
            })();
        });

        it('should be in the Nascent state after deployment', (done) => {
            Promise.coroutine(function* () {
                try {
                    const state = yield future.getState();
                    assert.equal(state, constants.STATES.NASCENT, `Expected the contract to have state set to ${constants.STATES.NASCENT} after deployment.`);
                } catch(err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
                    console.log('ERROR');
                    console.error(err);
                    assert.isNotOk(err, 'Expected the contract to be deployed without errors.');
                }

                done();
            })();
        });

        it('should correctly set the owner of the contract after deployment', (done) => {
            Promise.coroutine(function* () {
                try {
                    const owner = yield future.owner();
                    assert.equal(owner, accounts[0], 'Expected the owner state variable to be accounts[0]');
                } catch(err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
                    console.log('ERROR');
                    console.error(err);
                    assert.isNotOk(err, 'Expected the contract to be deployed without errors.');
                }

                done();
            })();
        });

        // checks for accuracy within 1 day
        it('should correctly set the creation_date of the contract after deployment', (done) => {
            Promise.coroutine(function* () {
                try {
                    const creation_timestamp = yield future.creation_timestamp();
                    const creation_date = createDateString(new Date(Number(creation_timestamp * 1000)));
                    const now = createDateString(new Date());
                    assert.equal(now, creation_date, 'Expected the creation date to be today.');
                } catch(err) {
                    if (err.name === constants.ERRORS.assertion.name) throw err;
                    console.log('ERROR');
                    console.error(err);
                    assert.isNotOk(err, 'Expected the contract to be deployed without errors.');
                }

                done();
            })();
        });
    });
};
