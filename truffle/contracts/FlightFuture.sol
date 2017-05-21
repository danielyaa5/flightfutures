pragma solidity ^0.4.8;

import './Future.sol';
import './StringUtils.sol';

/**
	TODO (general):
		- add more logging
        - validate all param data
		- move setting of conversion_rate and current_price to their own functions
		- shorten variable names
		- make future logic inheritable to flight future
		- add change offer price
*/
contract FlightFuture is Future {

    //	 URLs
    string public constant CONVERSION_URL = 'json(https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=ETH).ETH';
	string public constant PRICE_FLIGHT_BASE_URL = 'http://localhost:3031/contract/flight/';
	string public price_flight_url;

	string public flight_info;

    //	 Structs
	function FlightFuture(
		address dao_address,
		address seller_address,
		address dao_owner,

        // flight info
        string _flight_info,

    	// prices
        uint sell_price, 		  // primary
        uint target_price,		  // primary

        uint contract_length, 	  // days
		uint mark_to_market_rate, // hrs
        string seller_email
	) {
		// flight info
		flight_info = _flight_info;
		string memory price_flight_url = StringUtils.strConcat(PRICE_FLIGHT_BASE_URL, '/', flight_info);
		offer(dao_address, seller_address, dao_owner, sell_price, target_price, contract_length, mark_to_market_rate, seller_email, price_flight_url, CONVERSION_URL);
	}
}

