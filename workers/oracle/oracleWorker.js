'use strict';

const Promise = require('bluebird');
const request = require('request-promise');
const CronJob = require('cron').CronJob;
const Web3 = require('web3');
const contract = require('truffle-contract');
const DaoBuild = require('../../truffle/build/contracts/Dao.json');
const FlightFutureBuild = require('../../truffle/build/contracts/FlightFuture.json');

const REQ_FIELD_URL = 0;
const REQ_FIELD_TIMESTAMP = 1;
const REQ_FIELD_PROCESSED = 2;

const provider = new Web3.providers.HttpProvider('http://localhost:8545');

const Dao = contract(DaoBuild);
const FlightFuture = contract(FlightFutureBuild);

Dao.setProvider(provider);
FlightFuture.setProvider(provider);

const getDaoRequests = Promise.coroutine(function* getDaoRequests(dao) {
    const requests_length = yield dao.getRequestsLength();

    const requests = [];
    for (let i = 0; i < requests_length; i++) {
        const _dao_req = yield dao.getRequest(i);
        const dao_req = {
            url: _dao_req[REQ_FIELD_URL], timestamp: _dao_req[REQ_FIELD_TIMESTAMP], processed: _dao_req[REQ_FIELD_PROCESSED]
        };

        if (dao_req.processed === false) requests.push(dao_req);
    }

    return requests;
});

const getRequestData = Promise.coroutine(function* getRequestData(dao_req) {
    let data;
    console.log(dao_req);
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

const processRequests = Promise.coroutine(function* processRequests(requests) {
  for(let i = 0; i < requests.length; i++) {
        const dao_req = requests[i];
        const data = yield getRequestData(dao_req);
        console.log({ data });
  }
});

let on_tick_running = false;
const onTick = function onTick(dao) {
    return () => {
        if(on_tick_running === false) {
            return Promise.coroutine(function*() {
                on_tick_running = true;
                const requests = yield getDaoRequests(dao);
                console.log({ requests });
                yield processRequests(requests);
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
