'use strict';

const DEFAULT_GAS_LIMIT = 4712388;
const CONVERSION_URL = 'https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=ETH';
const ERRORS = {
    assertion: {
        name: 'AssertionError'
    }
};
const STATES = {
    NASCENT: 'Nascent', OFFERED: 'Offered', ACCEPTED: 'Accepted', MARKED: 'Marked',
    VERIFIED: 'Verified', PURCHASING: 'Purchasing', TICKET_PURCHASED: 'TicketPurchased',
    EXPIRED: 'Expired', DEFAULTED: 'Defaulted'
};

const EVENTS = {
    MARK_TO_MARKET: 'MarkedToMarketEvent'
};

module.exports = {
    DEFAULT_GAS_LIMIT,
    CONVERSION_URL,
    ERRORS,
    STATES,
    EVENTS
};