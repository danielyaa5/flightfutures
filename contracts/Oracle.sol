pragma solidity ^0.4.8;

import '../installed_contracts/zeppelin/contracts/ownership/Ownable.sol';

contract Oracle is Ownable {
    mapping(address => bool) AllowedAddressMap;

    struct Request {
        string url;
        function(string memory) external callback;
        uint timestamp;
        bool processed;
    }
    Request[] requests;
    uint request_id = 0;

    event NewRequestEvent (
        string _url,
        uint _timestamp,
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

    function addAllowedAddress(address addr) onlyOwner {
        AllowedAddressMap[addr] = true;
    }

    function request(string url, function(string memory) external callback) onlyAllowed {
        requests.push(Request(url, callback, 0, false));
        NewRequestEvent(url, 0, requests.length);
    }

    function request(string url, uint time_to_wait, function(string memory) external callback) external onlyAllowed {
        uint timestamp = time_to_wait == 0 ? 0 : (now + time_to_wait) * 1000;

        requests.push(Request(url, callback, timestamp, false));
        NewRequestEvent(url, timestamp, requests.length);
    }

    function response(string result, uint request_id) onlyOwner external onlyAllowed {
        if(requests[request_id].processed == true) throw;

        requests[request_id].callback(result);
    }
}
