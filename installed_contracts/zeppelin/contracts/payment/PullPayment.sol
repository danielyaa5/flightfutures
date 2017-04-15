pragma solidity ^0.4.8;


import '../SafeMath.sol';


/*
 * PullPayment
 * Base contract supporting async send for pull payments.
 * Inherit from this contract and use asyncSend instead of send.
 */
contract PullPayment is SafeMath {
  mapping(address => uint) public payments;

// store sent amount as credit to be pulled, called by payer
  function asyncSend(address dest, uint amount) internal {
    payments[dest] = safeAdd(payments[dest], amount);
  }

  function resetBalance(address dest) {
    payments[dest] = 0;
  }

// withdraw accumulated balance, called by payee
  function withdrawPayments() {
    address payee = msg.sender;
    uint payment = payments[payee];

    if (payment == 0) {
      throw;
    }

    if (this.balance < payment) {
      throw;
    }

    payments[payee] = 0;

    if (!payee.send(payment)) {
      throw;
    }
  }
}
