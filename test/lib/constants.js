'use strict';

const DEFAULTS = {
    GAS_LIMIT: 4712388,
    ACCEPT_FEE: 10
};
const CONVERSION_URL = 'https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=ETH';
const ERRORS = {
    assertion: {
        name: 'AssertionError'
    }
};
const STATES = {
    NASCENT: 'Nascent', OFFERED: 'Offered', ACCEPTING: 'Accepting', ACCEPTED: 'Accepted', MARKED: 'Marked',
    VERIFIED: 'Verified', PURCHASING: 'Purchasing', TICKET_PURCHASED: 'TicketPurchased',
    EXPIRED: 'Expired', DEFAULTED: 'Defaulted', CANCELED: 'Canceled'
};
const ALL_STATES = [STATES.NASCENT, STATES.OFFERED, STATES.ACCEPTING, STATES.ACCEPTED, STATES.MARKED, STATES.VERIFIED, STATES.PURCHASING, STATES.TICKET_PURCHASED, STATES.EXPIRED, STATES.DEFAULTED, STATES.CANCELED];
const EVENTS = {
    MARK_TO_MARKET: 'MarkedToMarketEvent',
    STATE_CHANGED: 'StateChangedEvent'

};

// helpers
const helpers = {};

helpers.getStateIndex = state => ALL_STATES.indexOf(state);

helpers.fromPricesStruct = prices_arr => ({
    sell_price: prices_arr[0].toNumber(),
    target_price: prices_arr[1].toNumber(),
    penalty_price: prices_arr[2].toNumber()
});

module.exports = {
    DEFAULTS,
    CONVERSION_URL,
    ERRORS,
    STATES,
    ALL_STATES,
    EVENTS,
    helpers
};
