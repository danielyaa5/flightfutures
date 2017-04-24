pragma solidity ^0.4.8;

contract Purchasable {
    address public buyer;
    address public seller;

    function Purchasable() {}

    modifier onlyBuyer() {
        if (msg.sender != buyer) {
            throw;
        }
        _;
    }

    modifier onlySeller() {
        if (msg.sender != seller) {
            throw;
        }
        _;
    }

    function setBuyer(address _buyer) internal {
        buyer = _buyer;
    }

    function setSeller(address _seller) internal {
        seller = _seller;
    }

    function resetBuyer() internal {
        buyer = address(0);
    }

    function resetSeller() internal {
        seller = address(0);
    }
}
