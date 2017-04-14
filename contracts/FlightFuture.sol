pragma solidity ^0.4.11;

import '../installed_contracts/zeppelin/contracts/ownership/Ownable.sol';
import '../installed_contracts/zeppelin/contracts/ownership/Contactable.sol';
import '../installed_contracts/zeppelin/contracts/payment/sol';
import '../installed_contracts/zeppelin/contracts/sol';

import '../installed_contracts/oraclize/oraclizeAPI_0.4.sol';

import '../installed_contracts/solidity-stringutils/strings.sol';

import './ConvertLib.sol';

/**
	TODO (General):
		- Replace throw with require and require when possible
		- Add more logging
		- Move setting of conversion_rate and cur_price to their own functions
*/
contract FlightFuture is Ownable, Contactable, PullPayment, SafeMath, ConvertLib, usingOraclize {
	using strings for *;

	// constants

	address constant COMPANY = 0x1234567;

	//structs

	struct FlightInfo { // TODO: add round-trip
        uint depart_date;
        string depart_location;
    }
	struct Prices { // all prices are in primary_currency
		uint sell_price;
        uint target_price; // TODO: should be hidden
        uint fail_price;
    }
	FlightInfo private flightInfo;
	Prices private prices;

	// events

	event PurchasedEvent (
        address indexed _buyer,
        address indexed _seller,
		uint _price
	);
	event OfferedEvent (
		address indexed _seller,
		uint _price
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

    enum ContractState { Offered, Purchased, Marked, BalanceVerified, BuyingTicket, TicketPurchased, Expired, Defaulted }
	string[8] private state_strings =
		['Offered', 'Purchased', 'Marked', 'BalanceVerified', 'BuyingTicket', 'TicketPurchased', 'Expired', 'Defaulted'];
    ContractState private state = ContractState.Offered;

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
		uint flight_depart_date,
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

		require(msg.sent == fail_price); // To create a contract, you must put the failure penalty up. Prevents backing out.

		conversion_rate = setConversionRate(); // update conversion rate
		contract_balance = msg.sent;
        prices = createPrices(sell_price, target_price, fail_price);
        flightInfo = FlightInfo(flight_depart_date, flight_depart_location);
        expiration = safeAdd(now, contract_length);
        owner = msg.sender;
        cur_price = setLowPrice();
        pub_key = company_pub_key;
        buyer_contact_information = buyer_email;
        setContactInformation(owner_email);
        OfferedEvent(owner, flightToString(flightInfo));
		// validatePrices();
		// validateFlightInfo()
		// bool round_trip = flight_return_date != '' && flight_return_location != '';
	}

	// constructor helpers

	function flightToString(FlightInfo flight) constant private returns (string) {
		return strConcat(flight.depart_date, flight.depart_location);
	}

	function createPrices(sell_price, target_price, fail_price) constant private returns (Prices) {
		return Prices(
            primaryToWei(sell_price),
            primaryToWei(target_price),
            primaryToWei(fail_price)
		);
	}

	// validators

	function validatePrices() constant private constant {
        if (prices.target_price > prices.sell_price) throw; // This wouldn't make economic sense
		if (!arrayContains(VALID_CURRENCIES, prices.currency)) throw;
		if (prices.fail_price == 0 || prices.target_price == 0 || prices.sell_price) throw;
	}

	function validateFlightInfo() constant private constant {
		if (flightInfo.depart_date <= now) throw;
	}

	// Purchase Logic

	function buyContract() external payable {
		if (state != ContractState.Offered) throw;
		if (msg.sent != sellPrice) throw;
		if (now >= expiration) throw;
		if (msg.sender == owner) throw;
		if (now >= flightInfo.depart_date) throw;

		state = changeState(ContractState.Purchased);
		buyer = msg.sender;
    	contract_balance = safeAdd(contract_balance, msg.value);
		startContract();
		PurchasedEvent(buyer, seller, sellPrice);
	}

	function startContract() private {
		setConversionRate();
	}
	// Termination Logic

	function contractExpired() private {
		asyncSend(buyer, contract_balance);
		changeState(ContractState.Expired);
	}

	function ownerDefault() private {
		asyncSend(buyer, contract_balance);
		changeState(ContractState.Defaulted);
	}

	// Mark to Market Logic

	// This function gets called periodically to adjust the money in the contract
	function markToMarket() private {
    	checkBalance();
		assert(state == ContractState.BalanceVerified);
        if (shouldBuy()) {
            internalBuyTicket(); // Purchase the ticket
        } else {
            expected_balance = safeAdd(cur_price, prices.fail_price);
            changeState(ContractState.Marked);
            MarkedToMarketEvent(cur_price, contract_balance, expected_balance);
        }
	}

	function checkBalance() private {
		// the contract has not been marked yet no reason to check
    	if (state == ContractState.Purchased) {
			changeState(ContractState.BalanceVerified);
        	return;
		}

		// if the contract isn't marked to market we shouldn't be calling checkBalance
		assert(state == ContractState.Marked);

		if (expiration <= now) {
            contractExpired();
        	return;
		}

		resetBalance(owner);
		resetBalance(buyer);
		int balance_diff = int(contract_balance) - int(expected_balance);

		// if the there is a negative balance, the contract has a deficit and is overdue
		if (balanceDiff < 0) {
        	ownerDefault();
			return;
		}

        if (balance_diff > 0) {
            // if the contract has an excess balance then expected we can send money back to the owner
            asyncSend(owner, balance_diff);
		}

		changeState(ContractState.BalanceVerified);
	}

	// Purchase Ticket Logic

	function shouldBuy() private returns (bool) {
		return cur_price <= prices.target_price;
	}

	function internalBuyTicket() private {
		if (
				state != ContractState.Purchased &&
				state != ContractState.Marked &&
				state != ContractState.BalanceVerified
		) throw;

		asyncSend(COMPANY, prices.target_price);
		changeState(ContractStates.BuyingTicket);
	}

	function externalBuyTicket() onlyOwner external returns (bool) {
		if (
				state != ContractState.Purchased &&
				state != ContractState.Marked &&
				state != ContractState.BalanceVerified
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
		if (!ContractState.BuyingTicket) throw;

		if (!isPrivKeyValid(priv_key)) throw;

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
	function isValidPrivKey(priv_key) private returns (bool) {
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
			setConversionRateCb();
		} else {
			setLowPriceCb();
		}
	}

	// get conversion rate from primary to wei
	function setConversionRate() constant private {
		// TODO: Should TLSNotary Proof be implemented?
		string query = strConcat('json(https://min-api.cryptocompare.com/data/price?fsym=', primary_currency);
		query = strConcat(query, '&tsyms=ETH).ETH');
        conversion_query_id = oraclize_query(mark_to_market_rate, 'URL', query);
	}

	function setConversionRateCb(uint primary_to_eth) private {
		conversion_rate = primary_to_eth * etherToWei(1);
		setLowPrice();
	}

	function setLowPrice() constant public returns (uint) {
		string query = 'xml(https://www.fueleconomy.gov/ws/rest/fuelprices).fuelPrices.diesel'; // TODO: Replace with API for checking prices
		price_query_id = oraclize_query('URL', query);
	}

	function setLowPriceCb(uint low_price_primary) private {
		cur_price = primaryToWei(low_price);
		markToMarket();
	}

	// General Helpers

	function changeState(ContractState _state) private {
		if (_state == state) return;

		string prev_state = state_strings(uint(state));
		state = _state;
		StateChanged(prev_state, state);
	}

	function arrayContains(array, val) constant private returns (bool) {
		for (var i = 0; i < array.length; i++) {
			if (array[i] == val) return true;
        }
		return false;
	}

	function primaryToWei(uint price) constant private returns (uint) {
		assert(conversion_rate != 0);
		return convert(price, conversion_rate);
	}
}
