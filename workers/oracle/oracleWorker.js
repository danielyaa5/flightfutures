'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const CronJob = require('cron').CronJob;
const Web3 = require('web3');
const debug = require('debug')('workers:oracleWorker');
const SolidityCoder = require('web3/lib/solidity/coder.js');
const contract = require('truffle-contract');

const DaoBuild = require('../../truffle/build/contracts/Dao.json');
const FlightFutureBuild = require('../../truffle/build/contracts/FlightFuture.json');

const REQ_FIELD_URL = 0;
const REQ_FIELD_TIMESTAMP = 1;
const REQ_FIELD_FLIGHTFUTURE_ADDRESS = 2;
const REQ_FIELD_PROCESSED = 3;

const provider = new Web3.providers.HttpProvider('http://localhost:8545');
const web3 = new Web3(provider);
const owner_account = web3.eth.accounts[0];

const Dao = contract(DaoBuild);
const FlightFuture = contract(FlightFutureBuild);

Dao.setProvider(provider);
FlightFuture.setProvider(provider);

const getDaoRequests = Promise.coroutine(function* getDaoRequests(dao) {
    const requests_length = yield dao.getRequestsLength({ from: owner_account });

    const requests = [];
    for (let i = 0; i < requests_length; i++) {
        const _dao_req = yield dao.getRequest(i);
        const dao_req = {
            id: i, url: _dao_req[REQ_FIELD_URL], timestamp: _dao_req[REQ_FIELD_TIMESTAMP],
            flightfuture_address: _dao_req[REQ_FIELD_FLIGHTFUTURE_ADDRESS], processed: _dao_req[REQ_FIELD_PROCESSED]
        };

        if (dao_req.processed === false) requests.push(dao_req);
    }

    return requests;
});

const getRequestData = Promise.coroutine(function* getRequestData(dao_req) {
    let data;
    const {url} = dao_req;

    if (url.indexOf('json(') === 0) {
        const r1 = /json\(([^)]+)\)/;
        const r2 = /json\([^)]+\).(.*)/;

        const _url = r1.exec(url)[1];
        const fields = r2.exec(url)[1].split('.');

        data = JSON.parse(yield request(_url));

        fields.forEach((field) => {
            data = data[field];
        });
        data = JSON.stringify(data);
    } else {
        data = yield(request(url));
    }

    return data;
});

let on_tick_running = false;
const onTick = function onTick(dao) {
    return () => {
        if(on_tick_running === false) {
            return Promise.coroutine(function*() {
                on_tick_running = true;
                const requests = yield getDaoRequests(dao);
                debug({ requests: requests });

                for(let i = 0; i < requests.length; i++) {
                    const dao_req = requests[i];
                    const data = yield getRequestData(dao_req);
                    debug({ data });
                    const info = web3.eth.getBlock('latest');
                    const tx = yield dao.response(data, dao_req.id, {from: owner_account, gas: info.gasLimit});
                    const log = tx.receipt.logs[0];
                    const log_data = SolidityCoder.decodeParams(['string', 'uint'], log.data.replace('0x', ''));
                    debug('response logs', JSON.stringify(log_data, null, 2));;
                    const future = FlightFuture.at(dao_req.flightfuture_address);
                    const conversion_rate = yield future.conversion_rate();
                    const accept_payment = yield future.accept_payment();
                    const state = yield future.getState();
                    const buyer = yield future.buyer();
                    debug({ buyer: buyer.toString(), state: state.toString(), conversion_rate: web3.fromWei(conversion_rate.toString()), accept_payment: web3.fromWei(accept_payment.toString())});
                }
            })()
            .catch(err => console.error(err))
            .finally(() => {
                on_tick_running = false
            });
        }
    }
};

const oracleWorker = (dao_address) => {
    const dao = Dao.at(dao_address);
    return new CronJob({
        cronTime: '* * * * * *', // every second
        onTick: onTick(dao),
        start: true
    });
};

module.exports = oracleWorker;
