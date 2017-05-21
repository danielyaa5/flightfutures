pragma solidity ^0.4.8;

import '../installed_contracts/zeppelin/contracts/ownership/Ownable.sol';

import './Oracle.sol';
import './FlightFuture.sol';
import './StringUtils.sol';

contract Dao is Ownable, Oracle {
    function Dao() {}

    event NewFlightFutureEvent(
        address _contract
    );

    function newFlightFuture(
        string flight_info,

        // prices
        uint sell_price, 		  // primary
        uint target_price,		  // primary

        uint contract_length, 	  // days
        uint mark_to_market_rate, // hrs
        string seller_email
    ) external {
        FlightFuture new_contract = new FlightFuture(this, msg.sender, owner, flight_info,
            sell_price, target_price, contract_length, mark_to_market_rate, seller_email);
        addAllowedAddress(new_contract);
        NewFlightFutureEvent(new_contract);
    }
}
