'use strict';

module.exports.pretty = function pretty(x) {
    return JSON.stringify(x, null, 2);
};

module.exports.toPSTString = function toPSTString(date) {
    date = new Date(date);
    const offset = -7;
    return new Date( date.getTime() + offset * 3600 * 1000).toUTCString().replace( / GMT$/, ' PST' );
};