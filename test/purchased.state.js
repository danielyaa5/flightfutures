'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:flightfuture.purchased');

const constants = require('./constants');
const lib = require('./lib');

const FlightFuture = artifacts.require('./FlightFuture');

const purchased = function purchased(web3) {
    let future;
    const test_buyer_email = 'test@foobar.com';
    const penalty_price = web3.toWei(0.1);
    const sell_price = web3.toWei(1);
    const valid_offer_params = [
        1493535600000,          // epoch depart date
        '04/30/2017',           // depart date
        'LAX',                  // depart location
        'CDG',                  // destination location
        sell_price,             // sell price wei
        600,                    // target price primary
        penalty_price,          // penalty price wei
        42,                     // contract length (days)
        'owner@foobar.com',     // owner email
        'public_key'            // public key
    ];

    contract('Purchased', (accounts) => {

    });
};

module.exports = purchased;
