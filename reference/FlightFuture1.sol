pragma solidity ^0.4.8;
//
//import '../installed_contracts/zeppelin/contracts/ownership/Ownable.sol';
//import '../installed_contracts/zeppelin/contracts/payment/PullPayment.sol';
//import '../installed_contracts/zeppelin/contracts/SafeMath.sol';
//
//import '../installed_contracts/oraclize/oraclizeAPI_0.4.sol';
//
//import './Purchasable.sol';
//import './Converter.sol';
//
///**
//	TODO (General):
//		- Add more logging
//        - Validate all param data
//		- Move setting of conversion_rate and current_price to their own functions
//		- Shorten variable names
//		- Make future logic inheritable to flight future
//*/
//contract FlightFuture is Purchasable, SafeMath, Ownable, PullPayment, Converter, usingOraclize {
//
//	// Constants
//
//	address constant COMPANY = address(0);
//	address constant ORACLIZE = 0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475;
//    string constant CONVERSION_URL = 'json(https://min-api.cryptocompare.com/data/price?fsym=USD&tsyms=ETH).ETH';
//
//	// Public
//
//	Prices public prices;
//	address public seller;
//	address public buyer;
//	uint public oraclize_url_query_cost;
//	uint public contract_length; // seconds
//	uint public expiration;
//	uint public accept_fee; // wei
//	uint public creation_timestamp;
//	uint public conversion_rate; // primary currency to wei
//	string public min_random_price; // REMOVE before prod
//	string public max_random_price; // REMOVE before prod
//
//	// flight info
//	string public depart_date;
//	string public depart_location;
//	string public destination_location;
//
//	// Private
//
//	string[11] private state_strings =
//	['Nascent', 'Offered', 'Accepting', 'Accepted', 'Marked', 'Verified', 'Purchasing', 'TicketPurchased', 'Expired', 'Defaulted', 'Canceled'];
//	string private buyer_contact_information;
//	string private seller_contact_information;
//	string private primary_currency = 'USD';
//
//	// prices and balances in wei
//	uint private current_price;
//	uint private expected_balance;
//	uint private depart_date_epoch;
//
//	// Structs
//
//	struct Prices {
//        // TODO: add change price function
//        uint sell_price; 		// primary
//
//        // TODO: should be hidden
//        uint target_price; 		// primary
//        uint penalty_price; 	// wei
//	}
//
//	// Events
//
//	event AcceptedEvent (
//		address indexed _buyer,
//		address indexed _seller,
//		uint _price
//	);
//	event OfferedEvent (
//		address indexed _seller,
//		uint _price,
//		string _flight_info
//	);
//	event MarkedToMarketEvent (
//		uint _current_price,
//		uint _contract_balance,
//		uint _expected_balance
//	);
//	event PurchasedTicketEvent (
//		uint _price
//	);
//	event StateChangedEvent (
//		string _prev_state,
//		string _new_state
//	);
//	event OraclizeCbEvent(
//        bytes32 query_id,
//        string result,
//        uint timestamp
//	);
//
//	// Enums
//
//	enum ContractStates {
//		Nascent,
//		Offered,
//		Accepting,
//		Accepted,
//		Marked,
//		Verified,
//		Purchasing,
//		TicketPurchased,
//		Expired,
//		Defaulted,
//		Canceled
//	}
//	ContractStates private state = ContractStates.Nascent;
//
//	// Constructor
//
//	function FlightFuture(uint _accept_fee) {
//		if (_accept_fee == 0) throw;
//
//		OAR = OraclizeAddrResolverI(ORACLIZE); // TODO: Remove before production
//		accept_fee = _accept_fee;
//		creation_timestamp = now;
//	}
//
//	// Offer Logic
//
//	function offer(
//        // TODO: Send offer fee to company
//
//        // Flight info
//        uint flight_depart_date_epoch,
//        string flight_depart_date,
//        string flight_depart_location,
//        string flight_destination_location,
//
//        // Prices, all prices in lowest denomination of currency
//        uint sell_price, 		// primary
//        uint target_price, 		// primary
//        uint penalty_price, 	// wei
//
//        uint _contract_length, 	// days
//        string seller_email
//	) external payable {
//		require(state == ContractStates.Nascent);
//        require(msg.value == penalty_price); 							// To create a contract, you must put the failure penalty up. Prevents backing out.
//
//		prices = Prices(sell_price, target_price, penalty_price);
//		depart_date_epoch = flight_depart_date_epoch;
//		depart_date = flight_depart_date;
//		depart_location = flight_depart_location;
//		destination_location = flight_destination_location;
//    	contract_length = _contract_length;
//		expiration = now + contract_length * 1 days;
//    	seller_contact_information = seller_email;
//    	seller = msg.sender;
//
//		_changeState(ContractStates.Offered);
//	}
//
//	// Accepting Logic
//
//	uint private accept_payment;
//	function accept(string buyer_email) external payable {
//		require(state == ContractStates.Offered);
//		require(msg.value > accept_fee);
//		require(now <= expiration);
//		require(msg.sender != seller);
//		require(now <= depart_date_epoch);
//
//		accept_payment = msg.value;
//		buyer = msg.sender;
//		buyer_contact_information = buyer_email;
//		_setConversionRate();
//		_changeState(ContractStates.Accepting);
//	}
//
//	function cancelAccept() external onlyBuyer {
//		_cancelAccept();
//	}
//
//	function _cancelAccept() private {
//		require(state == ContractStates.Accepting);
//
//		asyncSend(buyer, accept_payment); // oraclize fees are automatically taken out of msg.value (oraclize fee + oraclize gas cost)
//		accept_payment = 0;
//		buyer = address(0);
//		buyer_contact_information = '';
//		_changeState(ContractStates.Offered);
//	}
//
//	function _confirmAccept() private {
//    	require(conversion_rate > 0);
//		require(state == ContractStates.Accepting);
//
//		uint expected_value = safeAdd( _primaryToWei(prices.sell_price), accept_fee);
// 		if (expected_value > accept_payment) {
//			_cancelAccept();
//		} else {
//			uint diff = safeSub(accept_payment, expected_value);
//			asyncSend(buyer, diff); // Send back the difference
//		}
//
//		_changeState(ContractStates.Accepted);
//	}
//
//	// Termination Logic
//
//	function _contractExpired() private {
//		asyncSend(buyer, this.balance);
//		_changeState(ContractStates.Expired);
//	}
//
//	function _ownerDefault() private {
//		asyncSend(buyer, this.balance);
//		_changeState(ContractStates.Defaulted);
//	}
//
//	// Mark to Market Logic
//
//	// This function gets called periodically to adjust the money in the contract
//	function markToMarket() external onlyOwner {
////		_verifyBalance();
////		assert(state == ContractStates.Verified);
////		if (_shouldBuy()) {
////			_buyTicket(); // Purchase the ticket
////		} else {
////			expected_balance = safeAdd(current_price, prices.penalty_price);
////			_changeState(ContractStates.Marked);
////			MarkedToMarketEvent(current_price, this.balance, expected_balance);
////		}
//
//        MarkedToMarketEvent(current_price, this.balance, expected_balance);
//	}
//
//	function _verifyBalance() private {
//		// the contract has not been marked yet no reason to check
//		if (state == ContractStates.Accepted) {
//			_changeState(ContractStates.Verified);
//			return;
//		}
//
//		// if the contract isn't marked to market we shouldn't be calling _verifyBalance
//		assert(state == ContractStates.Marked);
//
//		if (expiration <= now) {
//			_contractExpired();
//			return;
//		}
//
//		resetBalance(owner);
//		resetBalance(buyer);
//		int balance_diff = int(this.balance) - int(expected_balance);
//
//		// if the there is a negative balance, the contract has a deficit and is overdue
//		if (balance_diff < 0) {
//			_ownerDefault();
//			return;
//		}
//
//		if (balance_diff > 0) {
//			// if the contract has an excess balance then expected we can send money back to the owner
//			asyncSend(owner, uint(balance_diff));
//		}
//
//		_changeState(ContractStates.Verified);
//	}
//
//	// Purchase Ticket Logic
//
//	function _shouldBuy() private returns (bool) {
//		return current_price <= _primaryToWei(prices.target_price);
//	}
//
//	function _buyTicket() private {
//		if (
//				state != ContractStates.Accepted &&
//				state != ContractStates.Marked &&
//				state != ContractStates.Verified
//		) throw;
//
//		asyncSend(COMPANY, prices.target_price);
//		_changeState(ContractStates.Purchasing);
//	}
//
//	// TODO: This will not work as is
//	function buyTicket() onlyOwner external returns (bool) {
//		if (
//				state != ContractStates.Accepted &&
//				state != ContractStates.Marked &&
//				state != ContractStates.Verified
//		) return false;
//
//		if (_shouldBuy()) {
//			asyncSend(COMPANY, prices.target_price);
//			_changeState(ContractStates.Purchasing);
//			return true;
//		}
//
//		return false;
//	}
//
//	// Confirm that the ticket was purchased, can only be called by overseeing company
//	function confirmTicketPurchased(string priv_key, int purchased_price) external payable {
//		if (state != ContractStates.Purchasing) throw;
//
//		if (!_isValidPrivKey(priv_key)) throw;
//
//		bool success = purchased_price > -1;
//
//		if (success) {
//			_ticketPurchaseSuccess(uint(purchased_price));
//		} else {
//			if (msg.value != prices.target_price) throw;
////			markToMarket();
//		}
//	}
//
//	function _ticketPurchaseSuccess(uint purchased_price) private {
//		uint left_over = safeSub(prices.target_price, purchased_price);
//		uint seller_payment = safeAdd(this.balance, left_over);
//		asyncSend(owner, seller_payment);
//		_changeState(ContractStates.TicketPurchased);
//	}
//
//
//	/////////////////
//	/// ORACLIZE ////
//	/////////////////
//
//	// query ids
//	mapping(bytes32 => bool) query_id_list;
//	bytes32 private conversion_query_id;
//	function __callback(bytes32 query_id, string result) {
//		// check if this query_id was already processed before
//		require(query_id_list[query_id] == false);
//
//		query_id_list[query_id] = true;
//
//		// just to be sure the calling address is the Oraclize authorized one
//		assert(msg.sender == oraclize_cbAddress());
//
//		OraclizeCbEvent(query_id, result, now);
//
//		oraclize_url_query_cost = oraclize_getPrice('URL');
//
//		if (query_id == conversion_query_id) {
//			_setConversionRateCb(result);
//		} else {
//			throw;
//		}
//	}
//
//	// get conversion rate from primary to wei
//	function _setConversionRate() private {
//		// TODO: Should TLSNotary Proof be implemented?
//		conversion_query_id = oraclize_query('URL', CONVERSION_URL, 500000);
//	}
//
//	function _setConversionRateCb(string result) private {
//		var (numerator, denominator) = stringToFraction(result);
//		conversion_rate = (numerator * etherToWei(1))/denominator;
//		_confirmAccept();
//	}
//
//
//	///////////////
//	/// HELPERS ///
//	///////////////
//
//
//	// TODO: Complete
//	function _isValidPrivKey(string priv_key) private returns (bool) {
//		return true;
//	}
//
//	// External Getters/Setters
//
//	function getTime() external returns (uint) {
//		return now;
//	}
//
//	function getSellerContactInfo() external returns (string)  {
//    	assert(msg.sender == owner || msg.sender == seller);
//		return seller_contact_information;
//	}
//
//	function getState() external constant returns (string) {
//		return state_strings[uint(state)];
//	}
//
//	// used for testing
//	function setState(uint _state) external onlyOwner {
//		state = ContractStates(_state);
//	}
//
//	// General Helpers
//
//	function _changeState(ContractStates new_state) private {
//		if (new_state == state) return;
//
//		string prev_state = state_strings[uint(state)];
//		state = new_state;
//		StateChangedEvent(prev_state, state_strings[uint(state)]);
//	}
//
//	function arrayContainsNumber(int[] array, int val) constant private returns (bool) {
//		for (var i = 0; i < array.length; i++) {
//			if (array[i] == val) return true;
//		}
//		return false;
//	}
//
//	function _primaryToWei(uint price) constant private returns (uint) {
//		assert(conversion_rate != 0);
//		return convert(price, conversion_rate);
//	}
//
//	// TODO: Remove after updating solidity version
//	function require(bool expression) private {
//		if (expression == false) throw;
//	}
//
//	// TODO: Remove after updating solidity version
//	function assert(bool assertion) private {
//		if (assertion == false) throw;
//	}
//
//	function _flightToString() constant private returns (string) {
//		string memory flight_string = strConcat('Leaving on ', depart_date, ' from ', depart_location);
//		flight_string = strConcat(flight_string, ' to ', destination_location);
//		return flight_string;
//	}
//
//	// Validators
//
//	function _validatePrices() constant private constant {
//		require(prices.target_price < prices.sell_price); // Ticket sell price should be greater than targeted purchase price.
//		// if (!arrayContains(VALID_CURRENCIES, prices.currency)) throw;
//		require(prices.penalty_price > 0 || prices.target_price > 0 || prices.sell_price > 0);
//	}
//
//	function _validateFlightInfo() constant private constant {
//		require(depart_date_epoch <= now);
//	}
//}
