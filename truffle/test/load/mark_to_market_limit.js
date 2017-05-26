'use strict';

/*
    Test to see how many times the contract can Mark To Market
    To run set LOAD_TEST environment variable to marktomarket
    No it clauses to avoid timeout
 */
const Promise = require('bluebird');
const request = require('request-promise');
const debug = require('debug')('contract-tests:flightfuture.markToMarketLoad');
const TestRPC = require("ethereumjs-testrpc");
const Web3 = require('web3');


const constants = require('../../future-lib/constants');
const lib = require('../../future-lib/utils');

const provider = TestRPC.provider();
const web3 = new Web3(provider);
const FlightFuture = artifacts.require('./FlightFuture');

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
const info = web3.eth.getBlock('latest');

const markToMarketLoad = function markToMarketLoad() {
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

    contract('Mark to Market Load Test', (accounts) => {

        const offer_transaction_options = {from: accounts[0], gas: constants.DEFAULT_GAS_LIMIT, value: penalty_price};
        const buy_transaction_options = {from: accounts[0], gas: constants.DEFAULT_GAS_LIMIT, value: sell_price };
        Promise.coroutine(function* () {
            try {
                future = yield FlightFuture.new();
                let marked_to_mark_count = 0;
                let lastEventTime;
                const events = future.allEvents((err, log) => {
                    if (err) return console.error(err);
                    if (log.event === constants.EVENTS.MARK_TO_MARKET) marked_to_mark_count++;
                    lastEventTime = new Date().getTime();
                    if (log.args.timestamp) log.args.timestamp = lib.toPSTString(log.args.timestamp * 1000);
                    return console.log(`\nContract Log: ${lib.pretty({ event: log.event, args: log.args })}\n`);
                });

                const random_price = yield request('http://localhost:3031/contract/test/price/random/400/900');
                console.log(`\nRandom Price: ${random_price}\n`);
                yield future.offer.apply(this, valid_offer_params.concat(offer_transaction_options));
                console.log('\nContract offered\n');
                const min_price = yield future.min_random_price();
                const max_price = yield future.max_random_price();
                console.log(`\n${lib.pretty({ 'Min Price': min_price, 'Max Price': max_price })}`);
                yield Promise.delay(20000);

                const conversion_rate = yield future.conversion_rate();
                console.log({'Conversion Rate': conversion_rate.toString(10) });


                console.log('\nbuying contract\n');
                yield future.buyContract(test_buyer_email, buy_transaction_options);
                const original_balance = web3.fromWei(web3.eth.getBalance(future.address).toNumber());

                console.time('logEvents');
                // wait until over a minute has passed since last event
                lastEventTime = new Date().getTime();
                while(new Date().getTime() - lastEventTime < 180 * 1000) {
                    yield Promise.delay(1000);
                }

                console.timeEnd('logEvents');
                events.stopWatching();
                console.log(`\nNumber of Mark To Markets ${marked_to_mark_count}\n`);
                const new_balance = web3.fromWei(web3.eth.getBalance(future.address).toNumber());
                console.log(`\nOld vs new balance: ${lib.pretty({original_balance, new_balance})}\n`)
            } catch (err) {
                if (err.name === constants.ERRORS.assertion.name) throw err;
                assert.isNotOk(err, 'Did not expect test to fail');
            }
        })();
    })
};

if (process.env.LOAD_TEST === 'marktomarket') markToMarketLoad();
