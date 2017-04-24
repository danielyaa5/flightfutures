pragma solidity ^0.4.8;

/**
    -TODO: Remove random price logic
    -TODO: Intelligently set gas limit for queries
*/
contract OraclizeStore is usingOraclize {

    // Constants
    address constant ORACLIZE = 0x1f2023555C63CA496C3A896fCDd31380476CC8f3;

    // urls
    string constant COMPANY_BASE_URL = 'http://3b8c68c1.ngrok.io';
    string constant CRYPTO_COMPARE_BASE_URL = 'https://min-api.cryptocompare.com';

    // routes
    string constant GET_RANDOM_PRICE_ROUTE = '/contract/test/price/random';

    // Internals
    uint internal conversion_rate;

    // Privates

    address private future_address;

    // query ids
    bytes32 private conversion_query_id;
    bytes32 private conversion_immediate_query_id;
    bytes32 private price_query_id;
    bytes32 private random_query_id;

    // Events

    event OraclizeCb(
        bytes32 query_id,
        string result,
        uint timestamp
    );

    // Constructor
    function OraclizeStore(){
        OAR = OraclizeAddrResolverI(ORACLIZE); // TODO: Remove before production
    }

    // flow: startContract -> (wait 1 day) set conversion rate -> (no wait) setLowPrice -> markToMarket
    function __callback(bytes32 query_id, string result) {
        // check if this query_id was already processed before
        require(query_id_list[query_id] == false);

        query_id_list[query_id] = true;

        // just to be sure the calling address is the Oraclize authorized one
        assert(msg.sender == oraclize_cbAddress());

        OraclizeCb(query_id, result);

        if (query_id == conversion_query_id) {
            var (numerator, denominator) = stringToFraction(result);
            setConversionRateCb(numerator, denominator);
        } else if (query_id == conversion_immediate_query_id) {
            (numerator, denominator) = stringToFraction(result);
            setConversionRateImmediateCb(numerator, denominator);
        } else if (query_id == price_query_id) {
            uint low_price_primary = stringToUint(result);
            setLowPriceCb(low_price_primary);
        } else if (query_id == random_query_id) {
            getRandomPriceCb(result);
        } else {
            throw;
        }
    }

    // get conversion rate from primary to wei
    function setConversionRate() {
        // TODO: Should TLSNotary Proof be implemented?
        string memory query = concat('json(', CRYPTO_COMPARE_BASE_URL);
        query = concat(query, '/data/price?fsym=', primary_currency);
        query = concat(query, '&tsyms=ETH).ETH');
        conversion_query_id = oraclize_query('URL', query, 4000000); // TODO: Change back to mark to market
    }

    function setConversionRateCb(uint numerator, uint denominator) private {
        conversion_rate = (numerator * etherToWei(1))/denominator;
        setLowPrice();
    }

    function setLowPrice(string random_price) constant private {
        getRandomPrice();
        //		string memory query = 'json(';
        //		query = concat(query, COMPANY_BASE_URL);
        //		query = concat(query, COMPANY_TEST_ROUTE);
        //		query = concat(query, COMPANY_LOW_PRICE_ROUTE);
        //		query = concat(query, '/');
        //		query = concat(query, depart_location);
        //		query = concat(query, '/');
        //		query = concat(query, depart_date);
        //		query = concat(query, '/');
        //		query = concat(query, random_price);
        //		query = concat(query, ').price');
        //		price_query_id = oraclize_query('URL', query, 2000000);
    }

    function setLowPriceCb(uint low_price_primary) private {
        current_price = primaryToWei(low_price_primary);
        markToMarket();
    }

    // Generate a random number for the price.
    function getRandomPrice() constant private {
        string memory query = 'json(';
        query = concat(query, COMPANY_BASE_URL);
        query = concat(query, GET_RANDOM_PRICE_ROUTE, '/');
        query = concat(query, min_random_price, '/');
        query = concat(query, max_random_price);
        query = concat(query, ').price');
        random_query_id = oraclize_query('URL', query, 4000000);
    }

    function getRandomPriceCb(string price) constant private {
        setLowPriceCb(stringToUint(price));
    }
}
