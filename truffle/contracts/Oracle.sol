pragma solidity ^0.4.8;

import '../installed_contracts/zeppelin/contracts/ownership/Ownable.sol';

contract Oracle is Ownable {
    mapping(address => bool) AllowedAddressMap;

    struct Request {
        string url;
        function(string memory) external callback;
        uint timestamp;
        address flightfuture_address;
        bool processed;
    }
    Request[] requests;
    uint request_id = 0;

    event NewRequestEvent (
        string _url,
        uint _timestamp,
        address _flightfuture_address,
        uint _id
    );

    event NewResponseEvent (
        string _result,
        uint _id
    );

    modifier onlyAllowed() {
        if (AllowedAddressMap[msg.sender] == false) {
            throw;
        }
        _;
    }

    function Oracle() {
        addAllowedAddress(msg.sender);
    }

    function isAllowedAddress(address addr) constant external returns (bool) {
      return AllowedAddressMap[addr];
    }

    function addAllowedAddress(address addr) internal {
        AllowedAddressMap[addr] = true;
    }

    function request(string url, function(string memory) external callback) onlyAllowed {
        requests.push(Request(url, callback, 0, msg.sender, false));
        NewRequestEvent(url, 0, msg.sender, requests.length);
    }

    function request(string url, uint time_to_wait, function(string memory) external callback) external onlyAllowed {
        uint timestamp = time_to_wait == 0 ? 0 : (now + time_to_wait) * 1000;

        requests.push(Request(url, callback, timestamp, msg.sender, false));
        NewRequestEvent(url, timestamp, msg.sender, requests.length);
    }

    function response(string result, uint id) onlyOwner external {
        if(requests[id].processed == true) throw;

        NewResponseEvent(result, id);
        requests[id].callback(result);
        requests[id].processed = true;
    }

    function getRequestsLength() constant external onlyOwner returns (uint) {
        return requests.length;
    }

    function getRequest(uint i) constant external onlyOwner returns (string, uint, address, bool) {
        return (requests[i].url, requests[i].timestamp, requests[i].flightfuture_address, requests[i].processed);
    }
}
