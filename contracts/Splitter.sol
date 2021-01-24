//SPDX-License-Identifier: MIT
pragma solidity >= 0.6.0 < 0.7.0;

import "@openzeppelin/contracts/utils/Pausable.sol";

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

contract Splitter is Pausable {

    mapping(address => uint) public balances;

    event Deposit(
        address indexed sender,
        address indexed recipient1,
        address indexed recipient2,
        uint amount,
        uint remainder
    );

    event WithDraw(
        address indexed withdrawer,
        uint amount
    );

    constructor() Pausable() public {}

    function splitDeposit(address payable recipient1, address payable recipient2) external payable whenNotPaused {
        require(msg.value > 0, "The value must be greater than 0");
        require(recipient1 != recipient2, "The first recipient is the same as the second recipient");
        require(msg.sender != recipient1 && msg.sender != recipient2, "The sender cannot also be a recipient");

        uint split = msg.value / 2;

        balances[recipient1] = SafeMath.add(balances[recipient1], split);
        balances[recipient2] = SafeMath.add(balances[recipient2], split);

        uint remainder = SafeMath.mod(msg.value, 2);

        if(remainder != 0) {
            balances[msg.sender]  = SafeMath.add(balances[msg.sender], remainder);
        }

        emit Deposit(msg.sender, recipient1, recipient2, split, remainder);
    }

    function withdraw(uint amount) public whenNotPaused returns(bool) {
        require(amount > 0, "The value must be greater than 0");
        require(balances[msg.sender] >= amount, "There are insufficient funds");
        balances[msg.sender]  = SafeMath.sub(balances[msg.sender], amount);
        emit WithDraw(msg.sender, amount);
        msg.sender.transfer(amount);

        return true;
    }

    function pause() public {
        super._pause();
    }

    function unpause() public {
        super._unpause();
    }
}
