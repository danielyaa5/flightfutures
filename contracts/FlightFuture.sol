pragma solidity ^0.4.8;

import '../installed_contracts/zeppelin/contracts/ownership/Ownable.sol';
import '../installed_contracts/zeppelin/contracts/ownership/Contactable.sol';
import '../installed_contracts/zeppelin/contracts/payment/PullPayment.sol';
import '../installed_contracts/zeppelin/contracts/SafeMath.sol';

import '../installed_contracts/oraclize/oraclizeAPI_0.4.sol';

import './ConvertLib.sol';

/**
	TODO (General):
		- Replace throw with require and require when possible
		- Add more logging
		- Move setting of conversion_rate and cur_price to their own functions
*/
contract FlightFuture is SafeMath, Ownable, Contactable, PullPayment, usingOraclize {
	using ConvertLib for *;

	// constants

	address constant COMPANY = 0x1234567;
	string constant COMPANY_BASE_URL = 'http://localhost:3031';
	string constant COMPANY_GET_LOW_PRICE = '/low_price';

	//structs

	struct FlightInfo { // TODO: add round-trip
		uint depart_date_epoch;
        string depart_date;
        string depart_location;
    }
	FlightInfo private flightInfo;
	struct Prices { // all prices are in primary_currency
		uint sell_price;
        uint target_price; // TODO: should be hidden
        uint fail_price;
    }
	Prices private prices;

	// events

	event PurchasedEvent (
        address indexed _buyer,
        address indexed _seller,
		uint _price
	);
	event OfferedEvent (
		address indexed _seller,
		uint _price,
		string _flight_info
	);
	event MarkedToMarketEvent (
		uint _cur_price,
		uint _contract_balance,
		uint _expected_balance
	);
	event PurchasedTicketEvent (
		uint _price
	);
	event StateChangedEvent (
		string _prev_state,
		string _new_state
	);

	// enums

    enum ContractStates { Offered, Purchased, Marked, BalanceVerified, BuyingTicket, TicketPurchased, Expired, Defaulted }
	string[8] private state_strings =
		['Offered', 'Purchased', 'Marked', 'BalanceVerified', 'BuyingTicket', 'TicketPurchased', 'Expired', 'Defaulted'];
    ContractStates private state = ContractStates.Offered;

	// privates

	mapping(bytes32 => bool) query_id_list;
	address private owner;
	address private buyer;
	bytes32 private conversion_query_id;
	bytes32 private price_query_id;
	string private buyer_contact_information;
	string private pub_key;
	string private primary_currency = 'USD';
    uint private mark_to_market_rate = 60 * 60 * 24; // 1 day in seconds
	uint private expiration;
	// prices and balances in wei
	uint private cur_price;
	uint private contract_balance;
	uint private expected_balance;
	uint private conversion_rate; // primary currency to wei

	// Constructor

	function FlightFuture(
		// TODO: validate all constructor param data

		// Flight info
		uint flight_depart_date_epoch,
		string flight_depart_date,
		string flight_depart_location,

		// Prices, all prices in lowest denomination of currency
        uint sell_price,
        uint target_price,
        uint fail_price,

		uint contract_length, // days
        string buyer_email,
        string owner_email,
        string company_pub_key
	) payable {
		// TODO: Send offer fee to company

		require(msg.value == fail_price); // To create a contract, you must put the failure penalty up. Prevents backing out.

		setConversionRate(); // update conversion rate
		contract_balance = msg.value;
        prices = createPrices(sell_price, target_price, fail_price);
        flightInfo = FlightInfo(flight_depart_date_epoch, flight_depart_date, flight_depart_location);
        expiration = safeAdd(now, contract_length);
        owner = msg.sender;
        setLowPrice();
        pub_key = company_pub_key;
        buyer_contact_information = buyer_email;
        setContactInformation(owner_email);
        OfferedEvent(owner, prices.sell_price, flightToString());
		// validatePrices();
		// validateFlightInfo()
		// bool round_trip = flight_return_date != '' && flight_return_location != '';
	}

	// constructor helpers

	function flightToString() constant private returns (string) {
		return concat('Leaving on ', flightInfo.depart_date, ' from ', flightInfo.depart_location);
	}

	function createPrices(uint sell_price, uint target_price, uint fail_price) constant private returns (Prices) {
		return Prices(
            primaryToWei(sell_price),
            primaryToWei(target_price),
            primaryToWei(fail_price)
		);
	}

	// validators

	function validatePrices() constant private constant {
		require(prices.target_price < prices.sell_price); // Ticket sell price should be greater than targeted purchase price.
		// if (!arrayContains(VALID_CURRENCIES, prices.currency)) throw;
		require(prices.fail_price > 0 || prices.target_price > 0 || prices.sell_price > 0);
	}

	function validateFlightInfo() constant private constant {
		require(flightInfo.depart_date_epoch <= now);
	}

	// Purchase Logic

	function buyContract() external payable {
		require(state == ContractStates.Offered);
		require(msg.value == prices.sell_price);
		require(now <= expiration);
		require(msg.sender != owner);
		require(now <= flightInfo.depart_date_epoch);

		buyer = msg.sender;
		contract_balance = safeAdd(contract_balance, msg.value);
		startContract();
		changeState(ContractStates.Purchased);
		PurchasedEvent(buyer, owner, prices.sell_price);
	}

	function startContract() private {
		setConversionRate();
	}
	// Termination Logic

	function contractExpired() private {
		asyncSend(buyer, contract_balance);
		changeState(ContractStates.Expired);
	}

	function ownerDefault() private {
		asyncSend(buyer, contract_balance);
		changeState(ContractStates.Defaulted);
	}

	// Mark to Market Logic

	// This function gets called periodically to adjust the money in the contract
	function markToMarket() private {
    	checkBalance();
		assert(state == ContractStates.BalanceVerified);
        if (shouldBuy()) {
            internalBuyTicket(); // Purchase the ticket
        } else {
            expected_balance = safeAdd(cur_price, prices.fail_price);
            changeState(ContractStates.Marked);
            MarkedToMarketEvent(cur_price, contract_balance, expected_balance);
        }
	}

	function checkBalance() private {
		// the contract has not been marked yet no reason to check
    	if (state == ContractStates.Purchased) {
			changeState(ContractStates.BalanceVerified);
        	return;
		}

		// if the contract isn't marked to market we shouldn't be calling checkBalance
		assert(state == ContractStates.Marked);

		if (expiration <= now) {
            contractExpired();
        	return;
		}

		resetBalance(owner);
		resetBalance(buyer);
		int balance_diff = int(contract_balance) - int(expected_balance);

		// if the there is a negative balance, the contract has a deficit and is overdue
		if (balance_diff < 0) {
        	ownerDefault();
			return;
		}

        if (balance_diff > 0) {
            // if the contract has an excess balance then expected we can send money back to the owner
            asyncSend(owner, uint(balance_diff));
		}

		changeState(ContractStates.BalanceVerified);
	}

	// Purchase Ticket Logic

	function shouldBuy() private returns (bool) {
		return cur_price <= prices.target_price;
	}

	function internalBuyTicket() private {
		if (
				state != ContractStates.Purchased &&
				state != ContractStates.Marked &&
				state != ContractStates.BalanceVerified
		) throw;

		asyncSend(COMPANY, prices.target_price);
		changeState(ContractStates.BuyingTicket);
	}

	function externalBuyTicket() onlyOwner external returns (bool) {
		if (
				state != ContractStates.Purchased &&
				state != ContractStates.Marked &&
				state != ContractStates.BalanceVerified
		) return false;

		cur_price = setLowPrice();

		if (shouldBuy()) {
			asyncSend(COMPANY, prices.target_price);
			changeState(ContractStates.BuyingTicket);
			return true;
		}

		return false;
	}

	// Confirm that the ticket was purchased, can only be called by overseeing company
	function confirmTicketPurchased(string priv_key, int purchased_price) external payable {
		if (state != ContractStates.BuyingTicket) throw;

		if (!isValidPrivKey(priv_key)) throw;

		bool success = purchased_price > -1;

		if (success) {
			ticketPurchaseSuccess(uint(purchased_price));
		} else {
			if (msg.value != prices.target_price) throw;
			markToMarket();
		}
	}

	function ticketPurchaseSuccess(uint purchased_price) private {
		uint left_over = safeSub(prices.target_price, purchased_price);
		uint owner_payment = safeAdd(contract_balance, left_over);
		asyncSend(owner, owner_payment);
		changeState(ContractStates.TicketPurchased);
		PurchasedTicketEvent(purchased_price);
	}

	// TODO: Complete
	function isValidPrivKey(string priv_key) private returns (bool) {
		return true;
	}

	// Oracle Logic

	// flow: startContract -> (wait 1 day) setConversionRate -> (no wait) setLowPrice -> markToMarket
	function __callback(bytes32 query_id, string result) {
		require(query_id == conversion_query_id || query_id == price_query_id);

        // check if this query_id was already processed before
		require(query_id_list[query_id] != true);

        // just to be sure the calling address is the Oraclize authorized one
        assert(msg.sender == oraclize_cbAddress());

		query_id_list[query_id] = true;
		if (query_id == conversion_query_id) {
			uint primary_to_eth = stringToUint(result);
			setConversionRateCb(primary_to_eth);
		} else {
        	uint low_price_primary = stringToUint(result);
			setLowPriceCb(low_price_primary);
		}
	}

	// get conversion rate from primary to wei
	function setConversionRate() constant private {
		// TODO: Should TLSNotary Proof be implemented?
		string memory query = concat('json(https://min-api.cryptocompare.com/data/price?fsym=', primary_currency);
		query = concat(query, '&tsyms=ETH).ETH');
        conversion_query_id = oraclize_query(mark_to_market_rate, 'URL', query);
	}

	function setConversionRateCb(uint primary_to_eth) private {
		conversion_rate = primary_to_eth * ConvertLib.etherToWei(1);
		setLowPrice();
	}

	function setLowPrice() constant public returns (uint) {
		string memory test_value = '500';
		string memory query = 'json(';
		query = concat(query, COMPANY_BASE_URL);
		query = concat(query, COMPANY_GET_LOW_PRICE);
		query = concat(query, '/');
		query = concat(query, flightInfo.depart_location);
		query = concat(query, '/');
		query = concat(query, flightInfo.depart_date);
		query = concat(query, '/');
		query = concat(query, test_value);
		query = concat(query, ').price');
		price_query_id = oraclize_query('URL', query);
	}

	function setLowPriceCb(uint low_price_primary) private {
		cur_price = primaryToWei(low_price_primary);
		markToMarket();
	}

	// General Helpers

	function changeState(ContractStates _state) private {
		if (_state == state) return;

		string prev_state = state_strings[uint(state)];
		state = _state;
		StateChangedEvent(prev_state, state_strings[uint(state)]);
	}

	function arrayContainsNumber(int[] array, int val) constant private returns (bool) {
		for (var i = 0; i < array.length; i++) {
			if (array[i] == val) return true;
        }
		return false;
	}

	function primaryToWei(uint price) constant private returns (uint) {
		assert(conversion_rate != 0);
		return ConvertLib.convert(price, conversion_rate);
	}

	// TODO: Remove after updating solidity version
	function require(bool expression) private {
		if (expression == false) throw;
	}

    // TODO: Remove after updating solidity version
    function assert(bool assertion) private {
		if (assertion == false) throw;
	}

	function uintToString(uint v) constant returns (string str) {
		uint maxlength = 100;
		bytes memory reversed = new bytes(maxlength);
		uint i = 0;
		while (v != 0) {
			uint remainder = v % 10;
			v = v / 10;
			reversed[i++] = byte(48 + remainder);
		}
		bytes memory s = new bytes(i + 1);
		for (uint j = 0; j <= i; j++) {
			s[j] = reversed[i - j];
		}
		str = string(s);
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

	function concat(string _a, string _b, string _c, string _d, string _e) internal returns (string) {
		bytes memory _ba = bytes(_a);
		bytes memory _bb = bytes(_b);
		bytes memory _bc = bytes(_c);
		bytes memory _bd = bytes(_d);
		bytes memory _be = bytes(_e);
		string memory abcde = new string(_ba.length + _bb.length + _bc.length + _bd.length + _be.length);
		bytes memory babcde = bytes(abcde);
		uint k = 0;
		for (uint i = 0; i < _ba.length; i++) babcde[k++] = _ba[i];
		for (i = 0; i < _bb.length; i++) babcde[k++] = _bb[i];
		for (i = 0; i < _bc.length; i++) babcde[k++] = _bc[i];
		for (i = 0; i < _bd.length; i++) babcde[k++] = _bd[i];
		for (i = 0; i < _be.length; i++) babcde[k++] = _be[i];
		return string(babcde);
	}

	function concat(string _a, string _b, string _c, string _d) internal returns (string) {
		return concat(_a, _b, _c, _d, "");
	}

	function concat(string _a, string _b, string _c) internal returns (string) {
		return concat(_a, _b, _c, "", "");
	}

	function concat(string _a, string _b) internal returns (string) {
		return concat(_a, _b, "", "", "");
	}
}
