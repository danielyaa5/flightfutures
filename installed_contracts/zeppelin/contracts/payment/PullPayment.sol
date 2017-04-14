pragma solidity ^0.4.8;


/*
 * PullPayment
 * Base contract supporting async send for pull payments.
 * Inherit from this contract and use asyncSend instead of send.
 */
contract PullPayment {
  mapping(address => uint) public payments;

  // store sent amount as credit to be pulled, called by payer
  function asyncSend(address dest, uint amount) internal {
    payments[dest] += amount;
  }

  // change send amount for a payee, if not available throw
  function adjustBalance(address dest, uint amount) internal {
    require(payments[dest] >= amount);
    payments[dest] -= amount;
  }

  // resets the balance for a payee to 0
  function resetBalance(address dest) internal {
    payments[dest] = 0;
  }

  // returns the balance for a payee
  function getBalance(address dest) internal returns (uint) {
    return payments[dest];
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
