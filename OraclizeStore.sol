pragma solidity ^0.4.8;

/**
    -This file will replace oraclize logic in main contract
    -TODO: Intelligently set gas limit for queries
*/

contract OraclizeStore is usingOraclize {
    address constant ORACLIZE = 0x02BAec4011bF592D82689c52C5FA293D85ad39dc;
    string constant CONVERSION_URL = 'json(https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=ETH).ETH';

    struct Request {
        bytes data;
        function(bytes memory) internal callback;
        bool processed;
    }
    mapping(string => Request) requests;

    event NewRequest(uint);
    event OraclizeCb(
        bytes32 query_id,
        string result,
        uint timestamp
    );

    // Constructor
    function OraclizeStore(){
        OAR = OraclizeAddrResolverI(ORACLIZE); // TODO: Remove before production
    }

    function query_url(string url, function(bytes memory) internal callback) internal {
        query_id = oraclize_query('URL', url, 500000);
        requests[query_id] = Request(url, callback);
        NewRequest(requests.length - 1);
    }

    function __callback(bytes32 query_id, string result) {
        require(requests[query_id]);

        // check if this query_id was already processed before
        require(requests[query_id].processed == false);

        requests[query_id].processed = true;

        // just to be sure the calling address is the Oraclize authorized one
        assert(msg.sender == oraclize_cbAddress());

        OraclizeCb(query_id, result);

        requests[requestID].callback(response);
    }
}
