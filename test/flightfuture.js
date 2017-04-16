'use strict';
const ck = require('chronokinesis');

const FlightFuture = artifacts.require('./FlightFuture');

// HELPERS

const etherToWei = (ether) => ether * 1000000000000000000;

const offered = function offered(accounts) {
    describe('offered', () => {
        const valid_test_contract_params = [
            1493535600000, // epoch depart date
            '04/30/2017', // depart date
            'LAX', // depart location
            'CDG', // destination location
            1000, // sell price primary
            600, // target price primary
            etherToWei(4), // penalty price wei
            42, // contract length (days)
            'owner@foobar.com', // owner email
            'public_key' // public key
        ];


        it('should allow creation of contract with valid params', () => {
            return FlightFuture.new().deployed({ value: etherToWei(4) })
            .then((instance) => {
                console.log(instance);
            })
            .catch((err) => {
                console.log(err);
            });
        });

        it('should not allow creation of contract unless payment sent is equal to the penalty price param', () => {

        });

        it('should have a contract balance equal to the penalty price param', () => {

        });

        it('should correctly set the correct conversion rate upon creation', () => {

        });

        it('should correctly set the prices struct (sell_price, target_price, penalty_price)', () => {

        });

        it('should correctly set the flightInfo struct (depart_date, depart_location)', () => {

        });

        it('should correctly set the owner address to the msg.sender', () => {

        });

        it('should correctly set the contact information of the contract owner', () => {

        });

        it('should correctly set the pub_key', () => {

        });

        it('should fire the OfferedEvent with correct values', () => {

        });
    });
};

const purchased = function purchased(accounts) {
    describe('purchased', () => {

    });
};

const marked = function marked(accounts) {
    describe('marked', () => {

    });
};

const balanceVerified = function balanceVerified(accounts) {
    describe('balanceVerified', () => {

    });
};

const buyingTicket = function buyingTicket(accounts) {
    describe('buyingTicket', () => {

    });
};

const ticketPurchased = function offered(accounts) {
    describe('ticketPurchased', () => {

    });
};

const expired = function expired(accounts) {
    describe('expired', () => {

    });
};

const defaulted = function defaulted(accounts) {
    describe('defaulted', () => {

    });
};

contract('FlightFuture', (accounts) => {
    offered(accounts);
    purchased(accounts);
    marked(accounts);
    balanceVerified(accounts);
    buyingTicket(accounts);
    ticketPurchased(accounts);
    expired(accounts);
    defaulted(accounts);
});