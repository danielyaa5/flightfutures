pragma solidity ^0.4.8;

import '../installed_contracts/zeppelin/contracts/ownership/Ownable.sol';
import '../installed_contracts/zeppelin/contracts/SafeMath.sol';
import '../installed_contracts/zeppelin/contracts/payment/PullPayment.sol';

import './Oracle.sol';
import './FlightFuture.sol';
import './StringUtils.sol';

contract Dao is Ownable, SafeMath, PullPayment, StringUtils, Oracle {
    function Dao() {}

    function newFlightFuture(
        address buyer_address,

        string flight_info,

        // prices
        uint sell_price, 		  // primary
        uint target_price,		  // primary

        uint contract_length, 	  // days
        uint mark_to_market_rate, // hrs
        string seller_email
    ) external returns (address) {
        FlightFuture new_contract = new FlightFuture(this, msg.sender, flight_info,
            sell_price, target_price, contract_length, mark_to_market_rate, seller_email);
        addAllowedAddress(address(new_contract));
        return address(new_contract);
    }
}
