pragma solidity ^0.4.8;

import '../installed_contracts/zeppelin/contracts/ownership/Ownable.sol';
import '../installed_contracts/zeppelin/contracts/payment/PullPayment.sol';
import '../installed_contracts/zeppelin/contracts/SafeMath.sol';

import '../installed_contracts/oraclize/oraclizeAPI_0.4.sol';

import './Purchasable.sol';
import './Converter.sol';

/**
	TODO (General):
		- Add more logging
        - Validate all param data
		- Move setting of conversion_rate and current_price to their own functions
		- Shorten variable names
*/
contract FlightFuture is Purchasable, SafeMath, Ownable, PullPayment, Converter, usingOraclize {

	// Constants

	address constant COMPANY = address(0);
	address constant ORACLIZE = 0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475;
    string constant CONVERSION_URL = 'JSON(https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=ETH';

	// Public

	address public seller;
	address public buyer;
	uint public accept_fee;
	uint public creation_timestamp;
	uint public conversion_rate; // primary currency to wei
	string public min_random_price; // REMOVE before prod
	string public max_random_price; // REMOVE before prod

	// Private

	string[11] private state_strings =
	['Nascent', 'Offered', 'Accepting', 'Accepted', 'Marked', 'Verified', 'Purchasing', 'TicketPurchased', 'Expired', 'Defaulted', 'Canceled'];
	string private buyer_contact_information;
	string private seller_contact_information;
	string private pub_key;
	string private primary_currency = 'USD';
	uint private expiration;

	// flight info
	string private depart_date;
	string private depart_location;
	string private destination_location;

	// prices and balances in wei
	uint private current_price;
	uint private expected_balance;
	uint depart_date_epoch;

	// Structs

	struct Prices {
        // TODO: add change price function
        uint sell_price; 		// wei

        // TODO: should be hidden
        uint target_price; 		// primary
        uint penalty_price; 	// wei
	}
	Prices private prices;

	// Events

	event AcceptedEvent (
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
		uint _current_price,
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
	event OraclizeCb(
        bytes32 query_id,
        string result,
        uint timestamp
	);

	// Enums

	enum ContractStates {
		Nascent,
		Offered,
		Accepting,
		Accepted,
		Marked,
		Verified,
		Purchasing,
		TicketPurchased,
		Expired,
		Defaulted,
		Canceled
	}
	ContractStates private state = ContractStates.Nascent;

	// Constructor

	function FlightFuture(uint _accept_fee) {
		OAR = OraclizeAddrResolverI(ORACLIZE); // TODO: Remove before production
		accept_fee = _accept_fee;
		creation_timestamp = now;
	}

	// Offer Logic

	function offer(
        // TODO: Send offer fee to company

        // Flight info
        uint flight_depart_date_epoch,
        string flight_depart_date,
        string flight_depart_location,
        string flight_destination_location,

        // Prices, all prices in lowest denomination of currency
        uint sell_price, 		// wei
        uint target_price, 		// primary
        uint penalty_price, 	// wei

        uint contract_length, 	// days
        string seller_email
	) external payable {
		require(state == ContractStates.Nascent);
		require(msg.sender == owner);
        require(msg.value == penalty_price); 							// To create a contract, you must put the failure penalty up. Prevents backing out.

		prices = Prices(sell_price, target_price, penalty_price);
		depart_date_epoch = flight_depart_date_epoch;
		depart_date = flight_depart_date;
		depart_location = flight_depart_location;
		destination_location = flight_destination_location;
		expiration = safeAdd(now, daysToMs(contract_length));
    	seller_contact_information = seller_email;
    	seller = msg.sender;

		changeState(ContractStates.Offered);
	}

	// Accepting Logic

	uint private accept_payment;
	function accept(string buyer_email) external payable {
		require(state == ContractStates.Offered);
		require(msg.value > accept_fee);
		require(now <= expiration);
		require(msg.sender != seller);
		require(now <= depart_date_epoch);

		accept_payment = msg.value;
		buyer = msg.sender;
		buyer_contact_information = buyer_email;
		changeState(ContractStates.Accepting);
	}

	function cancelAcceptExt() external onlyBuyer {
		cancelAcceptInt();
	}

	function cancelAcceptInt() private {
		require(state == ContractStates.Accepting);

		asyncSend(buyer, safeSub(accept_payment, accept_fee));
		accept_payment = 0;
		buyer = address(0);
		buyer_contact_information = '';
		changeState(ContractStates.Offered);
	}

	function confirmAccept() private {
		require(state == ContractStates.Accepting);

		uint expected_value = safeAdd( primaryToWei(prices.sell_price), primaryToWei(accept_fee) );
 		if (expected_value > accept_payment) {
			cancelAcceptInt();
		} else {
			uint diff = safeSub(safeSub(expected_value, accept_payment), accept_fee);
			asyncSend(buyer, diff); // Send back the difference
		}

		changeState(ContractStates.Accepted);
	}

	// Termination Logic

	function contractExpired() private {
		asyncSend(buyer, this.balance);
		changeState(ContractStates.Expired);
	}

	function ownerDefault() private {
		asyncSend(buyer, this.balance);
		changeState(ContractStates.Defaulted);
	}

	// Mark to Market Logic

	// This function gets called periodically to adjust the money in the contract
	function markToMarket() private {
//		checkBalance();
//		assert(state == ContractStates.Verified);
//		if (shouldBuy()) {
//			internalBuyTicket(); // Purchase the ticket
//		} else {
//			expected_balance = safeAdd(current_price, prices.penalty_price);
//			changeState(ContractStates.Marked);
//			MarkedToMarketEvent(current_price, this.balance, expected_balance);
//		}

        MarkedToMarketEvent(current_price, this.balance, expected_balance);
	}

	function checkBalance() private {
		// the contract has not been marked yet no reason to check
		if (state == ContractStates.Accepted) {
			changeState(ContractStates.Verified);
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
		int balance_diff = int(this.balance) - int(expected_balance);

		// if the there is a negative balance, the contract has a deficit and is overdue
		if (balance_diff < 0) {
			ownerDefault();
			return;
		}

		if (balance_diff > 0) {
			// if the contract has an excess balance then expected we can send money back to the owner
			asyncSend(owner, uint(balance_diff));
		}

		changeState(ContractStates.Verified);
	}

	// Purchase Ticket Logic

	function shouldBuy() private returns (bool) {
		return current_price <= primaryToWei(prices.target_price);
	}

	function internalBuyTicket() private {
		if (
				state != ContractStates.Accepted &&
				state != ContractStates.Marked &&
				state != ContractStates.Verified
		) throw;

		asyncSend(COMPANY, prices.target_price);
		changeState(ContractStates.Purchasing);
	}

	// TODO: This will not work as is
	function externalBuyTicket() onlyOwner external returns (bool) {
		if (
				state != ContractStates.Accepted &&
				state != ContractStates.Marked &&
				state != ContractStates.Verified
		) return false;

		if (shouldBuy()) {
			asyncSend(COMPANY, prices.target_price);
			changeState(ContractStates.Purchasing);
			return true;
		}

		return false;
	}

	// Confirm that the ticket was purchased, can only be called by overseeing company
	function confirmTicketPurchased(string priv_key, int purchased_price) external payable {
		if (state != ContractStates.Purchasing) throw;

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
		uint seller_payment = safeAdd(this.balance, left_over);
		asyncSend(owner, seller_payment);
		changeState(ContractStates.TicketPurchased);
	}


	/////////////////
	/// ORACLIZE ////
	/////////////////

	// query ids
	mapping(bytes32 => bool) query_id_list;
	bytes32 private conversion_query_id;
	function __callback(bytes32 query_id, string result) {
		// check if this query_id was already processed before
		require(query_id_list[query_id] == false);

		query_id_list[query_id] = true;

		// just to be sure the calling address is the Oraclize authorized one
		assert(msg.sender == oraclize_cbAddress());

		OraclizeCb(query_id, result, now);

		if (query_id == conversion_query_id) {
			var (numerator, denominator) = stringToFraction(result);
			setConversionRateCb(numerator, denominator);
		}
	}

	// get conversion rate from primary to wei
	function setConversionRate() {
		// TODO: Should TLSNotary Proof be implemented?
		conversion_query_id = oraclize_query('URL', CONVERSION_URL);
	}

	function setConversionRateCb(uint numerator, uint denominator) private {
		conversion_rate = (numerator * etherToWei(1))/denominator;
		confirmAccept();
	}


	///////////////
	/// HELPERS ///
	///////////////


	// TODO: Complete
	function isValidPrivKey(string priv_key) private returns (bool) {
		return true;
	}

	// External Getters

	function getState() external constant returns (string) {
		return state_strings[uint(state)];
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
		return convert(price, conversion_rate);
	}

	// TODO: Remove after updating solidity version
	function require(bool expression) private {
		if (expression == false) throw;
	}

	// TODO: Remove after updating solidity version
	function assert(bool assertion) private {
		if (assertion == false) throw;
	}

	function flightToString() constant private returns (string) {
		string memory flight_string = strConcat('Leaving on ', depart_date, ' from ', depart_location);
		flight_string = strConcat(flight_string, ' to ', destination_location);
		return flight_string;
	}

	// Validators

	function validatePrices() constant private constant {
		require(prices.target_price < prices.sell_price); // Ticket sell price should be greater than targeted purchase price.
		// if (!arrayContains(VALID_CURRENCIES, prices.currency)) throw;
		require(prices.penalty_price > 0 || prices.target_price > 0 || prices.sell_price > 0);
	}

	function validateFlightInfo() constant private constant {
		require(depart_date_epoch <= now);
	}
}
