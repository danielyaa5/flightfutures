pragma solidity ^0.4.10;

import '../installed_contracts/zeppelin/contracts/ownership/Ownable.sol';
import '../installed_contracts/zeppelin/contracts/payment/PullPayment.sol';

import './StringUtils.sol';
import './Purchasable.sol';
import './Converter.sol';
import './Dao.sol';

/**
	TODO (General):
		- Add more logging
        - Validate all param data
		- Shorten variable names
		- Upgrade installed contracts
		- Upgrade solidity version
*/
contract Future is Purchasable, Ownable, PullPayment {

    // Public

    Dao public DaoContract;

    address public dao_owner;

    uint public sell_price;
    uint public contract_length; // seconds
    uint public expiration;
    uint public creation_timestamp;
    uint public conversion_rate; // primary currency to wei
    uint public mark_to_market_rate_secs;

    // prices and balances in wei
    uint public current_price;
    uint public expected_balance;
    uint public target_price; // TODO: Hide this

    string public conversion_feed_url;
    string public price_feed_url;
    string public buyer_email; // TODO: Hide this
    string public seller_email; // TODO: Hide this

    // Private

    string[11] private state_strings =
    ['Nascent', 'Offered', 'Accepting', 'Accepted', 'Marked', 'Verified', 'Expired', 'Defaulted', 'Canceled'];

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
        uint _contract_balance
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
    function Future() {
        creation_timestamp = now;
    }

    // Offer Logic

    function offer(
        address dao_address,
        address seller_address,
        address _dao_owner,
        // prices, all prices in lowest denomination of currency
        uint _sell_price, 		// primary
        uint _target_price, 		// primary

        uint _contract_length, 	// days
        uint _mark_to_market_rate_secs, // hrs
        string _seller_email,
        string _price_feed_url,
        string _conversion_feed_url
    ) payable {
        require(state == ContractStates.Nascent);

        DaoContract = Dao(dao_address);
        owner = _dao_owner;
        dao_owner = _dao_owner;
        sell_price = _sell_price;
        target_price = _target_price;
        contract_length = _contract_length;
        expiration = now + contract_length * 1 days;
        seller_email = _seller_email;
        seller = seller_address;
        price_feed_url = _price_feed_url;
        conversion_feed_url = _conversion_feed_url;
        mark_to_market_rate_secs = _mark_to_market_rate_secs;
        _changeState(ContractStates.Offered);
    }

    // Accepting Logic

    uint public accept_payment;
    function accept(string _buyer_email) external payable {
        require(state == ContractStates.Offered);
        require(msg.value > 0);
        require(now <= expiration);
        require(msg.sender != seller);

        accept_payment = msg.value;
        buyer = msg.sender;
        buyer_email = _buyer_email;
        DaoContract.request(conversion_feed_url, this.confirmAccept);
        _changeState(ContractStates.Accepting);
    }

    function cancelAccept() external onlyBuyer {
        _cancelAccept();
    }

    function _cancelAccept() private {
        require(state == ContractStates.Accepting);

        asyncSend(buyer, accept_payment);
        accept_payment = 0;
        buyer = address(0);
        buyer_email = '';
        _changeState(ContractStates.Offered);
    }

    function confirmAccept(string _conversion_rate) {
        require(state == ContractStates.Accepting);
        require(msg.sender == address(DaoContract));

        // conversion rate is usd to ether, multiply by 10**18 to convert to us cents to wei
        uint conversion_rate_uint = StringUtils.parseInt(_conversion_rate, 18) / 100;
        require(conversion_rate_uint > 0);
        conversion_rate = conversion_rate_uint;
        uint expected_value = _usCentsToWei(sell_price);

        if (expected_value > accept_payment) {
            _cancelAccept();
        } else {
            uint diff = accept_payment - expected_value;
            asyncSend(buyer, diff); // Send back the difference
            _changeState(ContractStates.Accepted);
            markToMarket('0');
        }
    }

    // This function gets called periodically to adjust the money in the contract
    function markToMarket(string _current_price) {
        require(msg.sender == address(DaoContract));

        // the contract has not been marked yet no reason to check
        if (state == ContractStates.Marked) {
            uint current_price_uint = StringUtils.parseInt(_current_price, 2);
            assert(current_price_uint > 0);
            current_price = current_price_uint;
            _verifyBalance();
            assert(state == ContractStates.Verified);
            MarkedToMarketEvent(current_price, this.balance);
        } else if (state != ContractStates.Accepted) {
            throw;
        }

        _changeState(ContractStates.Marked);
        DaoContract.request(price_feed_url, mark_to_market_rate_secs, this.markToMarket);
    }

    function _verifyBalance() private {
        // if the contract isn't marked to market we shouldn't be calling _verifyBalance
        assert(state == ContractStates.Marked);
        resetBalance(owner);
        resetBalance(buyer);
        int balance_diff = int(this.balance) - int(current_price);

        // if the there is a negative balance, the contract has a deficit and is overdue
        if (balance_diff < 0) {
            _sellerDefault();
            return;
        }

        // if the contract has an excess balance then expected we can send money back to the owner
        if (balance_diff > 0) {
            asyncSend(seller, uint(balance_diff));
        }

        _changeState(ContractStates.Verified);
    }

    function _sellerDefault() private {
        asyncSend(buyer, this.balance);
        _changeState(ContractStates.Defaulted);
    }

    function _usCentsToWei(uint price) constant private returns (uint) {
        assert(conversion_rate != 0);
        return Converter.convert(price, conversion_rate);
    }

    function _changeState(ContractStates new_state) private {
        if (new_state == state) return;

        string prev_state = state_strings[uint(state)];
        state = new_state;
        StateChangedEvent(prev_state, state_strings[uint(state)]);
    }

    // Getters/Setters
    function getState() constant returns (string) {
        return state_strings[uint(state)];
    }

    function setState(uint new_state) onlyOwner {
        state = ContractStates(new_state);
    }
}
