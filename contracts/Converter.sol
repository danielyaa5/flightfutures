pragma solidity ^0.4.8;

contract Converter {
	function convert(uint amount,uint conversionRate) returns (uint convertedAmount) {
		return amount * conversionRate;
	}

	function etherToWei(uint amount) returns (uint convertedAmount) {
		return amount *  1000000000000000000;
	}

	function daysToSecs(uint amount_days) returns (uint convertedAmount) {
		return amount_days * 24 * 60 * 60;
	}

	function appendUintToString(string inStr, uint v) constant returns (string str) {
		uint maxlength = 100;
		bytes memory reversed = new bytes(maxlength);
		uint i = 0;
		while (v != 0) {
			uint remainder = v % 10;
			v = v / 10;
			reversed[i++] = byte(48 + remainder);
		}
		bytes memory inStrb = bytes(inStr);
		bytes memory s = new bytes(inStrb.length + i + 1);
		uint j;
		for (j = 0; j < inStrb.length; j++) {
			s[j] = inStrb[j];
		}
		for (j = 0; j <= i; j++) {
			s[j + inStrb.length] = reversed[i - j];
		}
		str = string(s);
	}

	function stringToUint(string s) constant returns (uint result) {
		bytes memory b = bytes(s);
		uint i;
		result = 0;
		for (i = 0; i < b.length; i++) {
			uint c = uint(b[i]);
			if (c >= 48 && c <= 57) {
				result = result * 10 + (c - 48);
			}
		}
	}

	function stringToFraction(string s) constant returns (uint numerator, uint denominator) {
		bytes memory b = bytes(s);
		bool decimal_found = false;
		uint digits_to_right_of_decimal = 0;
		numerator = 0;
		denominator = 0;

		for (uint i = 0; i < b.length; i++) {
			uint c = uint(b[i]);
			if (c == 46 && decimal_found == false) {
				decimal_found = true;
			} else if (c >= 48 && c <= 57) {
            	if (decimal_found == true) digits_to_right_of_decimal++;

				numerator = numerator * 10 + (c - 48);
			} else {
				throw; // found a char that is not decimal or digit
			}
		}

		denominator = 10 ** digits_to_right_of_decimal;
	}
}
