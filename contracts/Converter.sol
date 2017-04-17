pragma solidity ^0.4.8;

contract Converter {
	function convert(uint amount,uint conversionRate) returns (uint convertedAmount) {
		return amount * conversionRate;
	}

	function etherToWei(uint amount) returns (uint convertedAmount) {
		return amount *  1000000000000000000;
	}

	function daysToMs(uint amount_days) returns (uint convertedAmount) {
		return amount_days * 86400000;
	}
}
