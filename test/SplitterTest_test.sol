//SPDX-License-Identifier: MIT
pragma solidity >= 0.5.0 < 0.7.0;
import "remix_tests.sol"; // this import is automatically injected by Remix.
import "../contracts/Splitter.sol";

contract SplitterTest {
    
    Splitter splitter;
    
    function beforeAll () public {
        splitter = new Splitter();
    }
    
    function testSplit() public {

        address senderAlice = 0x20601F1Ddb44E28b1511EdBD316A368D80116408;
        address payable receiverBob = 0x20601F1Ddb44E28b1511EdBD316A368D80116408;
        address payable receiverCarol = 0x24F1500890505ceD8534502ab403F20ce99feea0;

        uint bobInitBalance = address(receiverBob).balance;
        uint carolInitBalance = address(receiverCarol).balance;

        uint amount = 4;

        splitter.doDeposit(senderAlice, amount);

        uint bobBalance = address(receiverBob).balance;
        uint carolBalance = address(receiverCarol).balance;
        
        Assert.equal(bobBalance - bobInitBalance, 2, "Bob's balance should have increased by two wei");
        Assert.equal(carolBalance - carolInitBalance, 2, "Bob's balance should have increased by two wei");
    }
}
