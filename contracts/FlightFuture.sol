pragma solidity ^0.4.4;

import '../installed_contracts/zeppelin/Ownable.sol';
import './ConvertLib.sol';

contract FlightFuture is Ownable {
	// constants
	address constant COMPANY = 0x1234567;
	//	string[1] VALID_CURRENCIES = ['USD'];

	// TODO: Roundtrip
	struct FlightInfo {
        uint depart_date;
        string depart_location;
    }
	struct Prices {
        uint sell_price;
        uint target_price; // TODO: should be hidden
        uint fail_price;
    }

	event Purchase (
        address indexed _buyer,
        address indexed _seller,
		uint256 _price
	);
	event Offer (
		address indexed _seller,
		uint256 _price
	);
	event MarkToMarket (
		uint256 _price,
		uint256 _balance
	);

    enum ContractStates { Offered, Purchased, Marked, AttemptedTicketPurchase, Completed }

	FlightInfo private flightInfo;
	Prices private prices;
    ContractStates private state = ContractStates.Offered;
	string private currency = 'USD';
    uint private mark_to_market_rate = 1000 * 60 * 60 * 24; // 1 day
    uint private pullable_buyer_balance = 0;
    uint private pullable_seller_balance = 0;

	address seller;
	address buyer;
	string pub_key;
	uint expiration;
	uint cur_price;
	uint expected_balance;

	function FlightFuture(
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
		prices = createPrices(sell_price, target_price, fail_price);
		flightInfo = FlightInfo(flight_depart_date, flight_depart_location);
		expiration = now + contract_length;
		owner = msg.sender;
        cur_price = getLowPrice();
		pub_key = company_pub_key;
		Offer(owner, flightToString(flightInfo));
		// TODO: validate all constructor data
		// validatePrices();
		// validateFlightInfo()
		// bool round_trip = flight_return_date != '' && flight_return_location != '';
	}

	// Constructor Validators

	function validatePrices() constant {
        if (prices.target_price > prices.sell_price) throw; // This wouldn't make economic sense
		if (!arrayContains(VALID_CURRENCIES, prices.currency)) throw;
		if (prices.fail_price == 0 || prices.target_price == 0 || prices.sell_price) throw;
	}

	function validateFlightInfo() constant {
		if (flightInfo.depart_date <= now) throw;
	}

	// Purchase Logic

	function buyContract() payable {
		if (msg.sent != sellPrice) throw;
		if (now >= expiration) throw;
		if (msg.sender == owner) throw;
		if (now >= flightInfo.depart_date) throw;
		state = ContractStates.Purchased;
		buyer = msg.sender;
		Purchase(buyer, seller, sellPrice);
	}

	// Mark to Market Logic

	// This function gets called periodically to adjust the money in the contract, internal
	function markToMarket() {
		if (state != ContractStates.Purchased || state != ContractStates.Marked) throw;

		cur_price = getLowPrice();

		if (shouldBuy()) return buyTicket();

		expected_balance = cur_price + prices.fail_price;
		state = ContractStates.Marked;
	}

	function shouldBuy() returns (bool) {
		return cur_price <= prices.target_price;
	}

	function checkBalance() {
        if (state != ContractStates.Purchased || state != ContractStates.Marked) throw;

		if (purchTickBy <= now) return updateBuyerPBal()

		balanceDiff = expectedBalance - balance;
		if (balanceDiff > 0) return updateBuyerPBal();

		if (balanceDiff < 0) return updateSellerPBal();
	}

	// Purchase Ticket Logic

	// Confirm that the ticket was purchased, can only be called by overseeing company
	function confirmTickPurchased(privKey) {
		if (!attemptedTickPurch) throw;

		if (validPrivKey(privKey)) return tickPurchSuccess();

		return tickPurchFail();
	}

	function tickPurchSuccess() {
		pullableSellerBal = contract.bal;
	}

	function tickPurchFail() {
		attemptedTickPurch = false;
	}

	// Termination Logic

	function cancelContract() {
		if (purchased) throw;

		kill();
	}

	// HELPERS

	function arrayContains(array, val) constant returns (bool) {
		for (var i = 0; i < array.length; i++) {
			if (array[i] == val) return true;
        }
		return false;
	}

	function flightToString(FlightInfo flight) constant returns (string) {
		return flight.depart_date + flight.depart_location;
	}

	function createPrices(sell_price, target_price, fail_price) constant returns (Prices) {
		uint256 convert_rate = getConvertRate();
		return Prices(
						ConvertLib.convert(sell_price, convert_rate),
						ConvertLib.convert(target_price, convert_rate),
						ConvertLib.convert(fail_price, convert_rate)
				);
	}

	function getConvertRate() returns (uint256) {

	}
}
