pragma solidity ^0.4.4;

import '../installed_contracts/zeppelin/Ownable.sol'

contract FlightFuture is Ownable {
	// constants
	address constant COMPANY = 0x1234567;
	string[1] VALID_CURRENCIES = ['USD'];

	struct FlightInfo {
        uint flight_depart_date,
        uint flight_return_date,
        string flight_depart_location,
        string flight_return_location,
		bool roundTrip
    }
	struct Prices {
        string currency,
        uint sell_price,
        uint target_price, // TODO: should be hidden
        uint fail_price
    }

    enum ContractStates = { Offered, Purchased, AttemptedTicketPurchase, Completed };

	FlightInfo private flightInfo;
	Prices private prices;

    ContractStates private state = ContractStates.Offered;
    uint private mark_to_market_rate = 1000 * 60 * 60 * 24; // 1 day
    uint private pullable_buyer_balance = 0;
    uint private pullable_seller_balance = 0;

	function FlightFuture(
		// Flight info
		uint flight_depart_date,
		uint flight_return_date,
		string flight_depart_location,
		string flight_return_location,

		// Prices, all prices in lowest denomination of currency
        string currency,
        uint sell_price,
        uint target_price,
        uint fail_price,

        uint purch_tick_by,
        string buyer_email,
        string owner_email,
        string company_pub_key
	) {
		// TODO: validate all constructor data
		bool round_trip = flight_return_date != '' && flight_return_location != '';
		flightInfo = FlightInfo(flight_depart_date, flight_return_date, flight_depart_location, flight_return_location)
	}
	// Constructor Validators

	function validatePrices(Prices prices) constant {
        if (prices.target_price > prices.sell_price) throw; // This wouldn't make economic sense
		if (!arrayContains(VALID_CURRENCIES, prices.currency)) throw;
		if (prices.fail_price == 0 || prices.target_price == 0 || prices.sell_price) throw;
	}
	// Purchase Logic

	function buyContract() {
		if (moneySent != sellPrice) throw;


	}

	// Mark to Market Logic

	// This function gets called periodically to adjust the money in the contract, internal
	function markToMarket() {
		if (!purchased) throw;

		curPrice = getLowPrice(payCurrency);
		priceHist.push(curPrice);

		if (shouldBuy()) return buyTicket();

		expectedBalance = convertCurrency(curPrice + failPenalty, payCurrency)
		hasBeenMarked = true;
	}

	function shouldBuy returns (bool) {
		return currPrice <= targetPrice;
	}

	function checkBalance() {
		if (!purchased || !hasBeenMarked) throw;

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
}
