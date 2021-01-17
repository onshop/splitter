//SPDX-License-Identifier: MIT
pragma solidity >= 0.5.0 < 0.7.0;

contract Splitter {

    event Deposit(uint date,
                  address indexed sender,
                  address indexed recipient1,
                  address indexed recipient2,
                  uint amount,
                  uint remainder);

    function splitFunds(address payable recipient1, address payable recipient2) external payable{

        if(recipient1 == recipient2){
            revert("The first recipient is the same as the second recipient");
        }

        if(msg.sender == recipient1 || msg.sender == recipient2){
            revert("The sender cannot also be a recipient");
        }

        uint split = msg.value / 2;

        recipient1.transfer(split);
        recipient1.transfer(split);

        uint remainder = msg.value % 2;

        if(remainder != 0) {
            msg.sender.transfer(remainder);
        }

        emit Deposit(now, msg.sender, recipient1, recipient2, split, remainder);
    }
}
