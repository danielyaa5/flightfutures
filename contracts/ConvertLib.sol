pragma solidity ^0.4.4;

library ConvertLib{
	function convert(uint amount,uint conversionRate) returns (uint convertedAmount) {
		return amount * conversionRate;
	}

	function etherToWei(uint amount) returns (uint convertedAmount) {
		return amount * 1000000000000000000;
	}
}
