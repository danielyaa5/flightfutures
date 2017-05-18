pragma solidity ^0.4.8;

import '../installed_contracts/zeppelin/contracts/ownership/Ownable.sol';
import '../installed_contracts/zeppelin/contracts/payment/PullPayment.sol';
import '../installed_contracts/zeppelin/contracts/SafeMath.sol';

import './StringUtils.sol';
import './Purchasable.sol';
import './Converter.sol';
import './Dao.sol';

/**
	TODO (General):
		- Add more logging
        - Validate all param data
		- Shorten variable names
*/
contract Future is Purchasable, SafeMath, Ownable, PullPayment, Converter, StringUtils {

    // Constants

    // Public

    Prices public prices;
    address public seller;
    address public buyer;

    uint public contract_length; // seconds
    uint public expiration;
    uint public creation_timestamp;
    uint public conversion_rate; // primary currency to wei
    uint public accept_fee = 0;
    uint public mark_to_market_rate;

    string public conversion_feed_url;
    string public price_feed_url;

    // Private

    Dao private DaoContract;
    string[11] private state_strings =
    ['Nascent', 'Offered', 'Accepting', 'Accepted', 'Marked', 'Verified', 'Purchasing', 'TicketPurchased', 'Expired', 'Defaulted', 'Canceled'];
    string private buyer_contact_information;
    string private seller_contact_information;

    // prices and balances in wei
    uint private current_price;
    uint private expected_balance;

    // Structs

    struct Prices {
        uint sell_price; 		// primary

        // TODO: should be hidden
        uint target_price; 		// primary
    }

    // Events

    event AcceptedEvent (
        address indexed _buyer,
        address indexed _seller,
        uint _price
    );
    event OfferedEvent (
        address indexed _seller,
        uint _price
    );
    event MarkedToMarketEvent (
        uint _current_price,
        uint _contract_balance,
        uint _expected_balance
    );
    event StateChangedEvent (
        string _prev_state,
        string _new_state
    );

    // Enums

    enum ContractStates {
        Nascent,
        Offered,
        Accepting,
        Accepted,
        Marked,
        Verified,
        Expired,
        Defaulted,
        Canceled
    }
    ContractStates private state = ContractStates.Nascent;

    // Constructor
    function Future() {}

    // Offer Logic

    function offer(
        address dao_address,
        address buyer_address,
        // prices, all prices in lowest denomination of currency
        uint sell_price, 		// primary
        uint target_price, 		// primary

        uint _contract_length, 	// days
        uint _mark_to_market_rate, // hrs
        string seller_email,
        string _price_feed_url,
        string _conversion_feed_url
    ) external payable {
        require(state == ContractStates.Nascent);

        DaoContract = Dao(dao_address);
        buyer = buyer_address;
        creation_timestamp = now;
        prices = Prices(sell_price, target_price);
        contract_length = _contract_length;
        expiration = now + contract_length * 1 days;
        seller_contact_information = seller_email;
        seller = msg.sender;
        price_feed_url = _price_feed_url;
        conversion_feed_url = _conversion_feed_url;

        _changeState(ContractStates.Offered);
    }

    // Accepting Logic

    uint private accept_payment;
    function accept(string buyer_email) external payable {
        require(state == ContractStates.Offered);
        require(msg.value > accept_fee);
        require(now <= expiration);
        require(msg.sender != seller);

        accept_payment = msg.value;
        buyer = msg.sender;
        buyer_contact_information = buyer_email;
        DaoContract.request(conversion_feed_url, this.confirmAccept);
        _changeState(ContractStates.Accepting);
    }

    function cancelAccept() external onlyBuyer {
        _cancelAccept();
    }

    function _cancelAccept() private {
        require(state == ContractStates.Accepting);

        asyncSend(buyer, accept_payment); // oraclize fees are automatically taken out of msg.value (oraclize fee + oraclize gas cost)
        accept_payment = 0;
        buyer = address(0);
        buyer_contact_information = '';
        _changeState(ContractStates.Offered);
    }

    function confirmAccept(string _conversion_rate) {
        if (msg.sender != address(DaoContract)) throw;

        uint _conversion_rate_uint = parseInt(_conversion_rate);

        require(_conversion_rate_uint > 0);
        require(state == ContractStates.Accepting);

        conversion_rate = _conversion_rate_uint;
        uint expected_value = safeAdd( _primaryToWei(prices.sell_price), accept_fee);
        if (expected_value > accept_payment) {
            _cancelAccept();
        } else {
            uint diff = safeSub(accept_payment, expected_value);
            asyncSend(buyer, diff); // Send back the difference
        }

        _changeState(ContractStates.Accepted);
    }

    function _primaryToWei(uint price) constant private returns (uint) {
        assert(conversion_rate != 0);
        return convert(price, conversion_rate);
    }

    function _changeState(ContractStates new_state) private {
        if (new_state == state) return;

        string prev_state = state_strings[uint(state)];
        state = new_state;
        StateChangedEvent(prev_state, state_strings[uint(state)]);
    }

    // TODO: Remove after updating solidity version
    function require(bool expression) private {
        if (expression == false) throw;
    }

    // TODO: Remove after updating solidity version
    function assert(bool assertion) private {
        if (assertion == false) throw;
    }
}
