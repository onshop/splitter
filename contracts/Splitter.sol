//SPDX-License-Identifier: MIT
pragma solidity >= 0.5.0 < 0.7.0;

contract Splitter {
    
    address sender = 0xA2aDe56e2c69589eaFA636C845b296718D5766fd; //Alice
    
    address payable[] internal recipients = [0x20601F1Ddb44E28b1511EdBD316A368D80116408, //"Bob";
                                            0x24F1500890505ceD8534502ab403F20ce99feea0]; //"Carol";
    uint InitialValue = 100 ether;

    event Deposit(uint date,
                  address indexed _from,
                  address indexed _to,
                  uint amount);

    function deposit() external payable{

        if(msg.value % 2 != 0) {
            revert("Only even numbers can be sent");
        }

        if(msg.sender != sender){
            revert("Only Alice can send ether");
        }

        uint split = msg.value / 2;

        for (uint i=0; i < recipients.length; i++) {
            recipients[i].transfer(split);

            emit Deposit(now, msg.sender, recipients[i], split);
        }
    }
}
