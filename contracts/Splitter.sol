//SPDX-License-Identifier: MIT
pragma solidity >= 0.6.0 < 0.7.0;

import "../node_modules/@openzeppelin/contracts/access/Ownable.sol";
import "../node_modules/@openzeppelin/contracts/utils/Pausable.sol";

import {SafeMath} from "../node_modules/@openzeppelin/contracts/math/SafeMath.sol";

contract Splitter is Ownable, Pausable {

    using SafeMath for uint;

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

    function splitDeposit(address recipient1, address recipient2) external payable whenNotPaused {
        require(msg.value > 0, "The value must be greater than 0");
        require(recipient1 != recipient2, "The first recipient is the same as the second recipient");
        require(msg.sender != recipient1 && msg.sender != recipient2, "The sender cannot also be a recipient");

        uint split = msg.value / 2;

        balances[recipient1] = balances[recipient1].add(split);
        balances[recipient2] = balances[recipient2].add(split);

        uint remainder = SafeMath.mod(msg.value, 2);

        if (remainder != 0) {
            balances[msg.sender] = balances[msg.sender].add(remainder);
        }

        emit Deposit(msg.sender, recipient1, recipient2, split, remainder);
    }

    function withdraw(uint amount) public whenNotPaused returns(bool success) {
        uint256 withdrawerBalance = balances[msg.sender];
        require(amount > 0, "The value must be greater than 0");
        require(withdrawerBalance >= amount, "There are insufficient funds");

        balances[msg.sender] = SafeMath.sub(withdrawerBalance, amount);
        emit WithDraw(msg.sender, amount);
        (success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }

    function pause() public onlyOwner {
        super._pause();
    }

    function unpause() public onlyOwner {
        super._unpause();
    }
}
