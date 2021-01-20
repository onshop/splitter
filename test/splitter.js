const assert = require("chai").assert;
const truffleAssert = require('truffle-assertions');
const Splitter = artifacts.require("./Splitter.sol");

contract('Splitter', async accounts => {

    let gasCost = async receipt => {
        let gasUsed = receipt.receipt.gasUsed;
        let tx = await web3.eth.getTransaction(receipt.tx);
        let gasPrice = tx.gasPrice;

        return web3.utils.toBN(gasUsed * gasPrice);
    };

    const senderAddress = accounts[1]; //'0xA2aDe56e2c69589eaFA636C845b296718D5766fd';
    const RecipientOneAddress = accounts[2]; //'0x20601F1Ddb44E28b1511EdBD316A368D80116408';
    const RecipientTwoAddress = accounts[3]; //'0x24F1500890505ceD8534502ab403F20ce99feea0';
    let splitter;

    beforeEach("deploy and prepare", async function() {
        splitter = await Splitter.new();
    });

    it('Sender sends 5 wei, 4 wei is split equally between recipients and 1 wei sent to the senders balance', async () => {

        // Take snapshot of initial balances
        let initSenderEthBalance = await web3.eth.getBalance(senderAddress);
        initSenderEthBalance = web3.utils.toBN(initSenderEthBalance);

        let initSenderContractBalance = await splitter.getBalance(senderAddress);
        let initRecipientOneContractBalance = await splitter.getBalance(RecipientOneAddress);
        let initRecipientTwoContractBalance = await splitter.getBalance(RecipientTwoAddress);

        // Perform transactions
        const receipt = await splitter.splitDeposit(RecipientOneAddress, RecipientTwoAddress, {from: senderAddress, value: 5});

        const cost = await gasCost(receipt);

        console.log("cost = " + cost);

        const transfer = web3.utils.toBN(5);
        const splitAmount = web3.utils.toBN(2);
        const remainder = web3.utils.toBN(1);

        let expectedSenderEthBalance = initSenderEthBalance.sub(cost).sub(web3.utils.toBN(transfer));
        let aliceEthBalance = await web3.eth.getBalance(senderAddress);
        aliceEthBalance = web3.utils.toBN(aliceEthBalance);

        assert.strictEqual(aliceEthBalance.toString(10), expectedSenderEthBalance.toString(10));

        let expectedSenderContractBalance = initSenderContractBalance.add(remainder);
        let expectedRecipientOneContractBalance = initRecipientOneContractBalance.add(splitAmount);
        let expectedRecipientTwoContractBalance = initRecipientTwoContractBalance.add(splitAmount);

        let aliceContractBalance = await splitter.getBalance(senderAddress);
        let bobContractBalance = await splitter.getBalance(RecipientOneAddress);
        let carolContractBalance = await splitter.getBalance(RecipientTwoAddress);

        assert.strictEqual(aliceContractBalance.toString(10), expectedSenderContractBalance.toString(10));
        assert.strictEqual(bobContractBalance.toString(10), expectedRecipientOneContractBalance.toString(10));
        assert.strictEqual(carolContractBalance.toString(10), expectedRecipientTwoContractBalance.toString(10));

        truffleAssert.eventEmitted(receipt, 'Deposit', (ev) => {
            return  ev.sender === senderAddress && ev.recipient1 === RecipientOneAddress &&
                    ev.recipient2 === RecipientTwoAddress && ev.amount.toString(10) === "2" &&
                    ev.remainder.toString(10) === "1";
        }, 'TestEvent should be emitted with correct parameters');
    })

    it("Transaction reverts if the deposit amount is zero", async () => {
        await truffleAssert.reverts(
            splitter.splitDeposit(RecipientTwoAddress, RecipientOneAddress,{from: senderAddress, value: 0}),
            "The value must be greater than 0"
        );
    });

    it("Transaction reverts if the first recipient is the same as the second recipient", async () => {
        await truffleAssert.reverts(
            splitter.splitDeposit(RecipientOneAddress, RecipientOneAddress,{from: senderAddress, value: 4}),
            "The first recipient is the same as the second recipient"
        );
    });

    it("Transaction reverts if the sender's address is also a recipient", async () => {
        await truffleAssert.reverts(
            splitter.splitDeposit(senderAddress, RecipientTwoAddress, {from: senderAddress, value: 4}),
            "The sender cannot also be a recipient"
        );
    });

    it('Second recipient can successfully withdraw 2 wei', async () => {

        let depositAmount = web3.utils.toWei(web3.utils.toBN(1), "ether");
        const withDrawAmount = web3.utils.toBN(2);

        let initRecipientTwoEthBalance = await web3.eth.getBalance(RecipientTwoAddress);
        initRecipientTwoEthBalance = web3.utils.toBN(initRecipientTwoEthBalance);

        await splitter.splitDeposit(RecipientOneAddress, RecipientTwoAddress, {from: senderAddress, value: depositAmount});

        let initRecipientTwoContractBalance = await splitter.getBalance(RecipientTwoAddress);
        initRecipientTwoContractBalance = web3.utils.toBN(initRecipientTwoContractBalance)

        const receipt = await splitter.withdraw(withDrawAmount, {from: RecipientTwoAddress});

        const cost = await gasCost(receipt);

        let carolEthBalance = await web3.eth.getBalance(RecipientTwoAddress);
        let carolContractBalance = await splitter.getBalance(RecipientTwoAddress);
        let expectedRecipientTwoEthBalance = initRecipientTwoEthBalance.sub(cost).add(withDrawAmount);
        let expectedRecipientTwoContractBalance = initRecipientTwoContractBalance.sub(withDrawAmount);

        assert.strictEqual(carolEthBalance.toString(10), expectedRecipientTwoEthBalance.toString(10));
        assert.strictEqual(carolContractBalance.toString(10), expectedRecipientTwoContractBalance.toString(10));

        truffleAssert.eventEmitted(receipt, "WithDraw", (ev) => {
            return  ev.withdrawer === RecipientTwoAddress && ev.amount.toString(10) === "2";
        }, 'TestEvent should be emitted with correct parameters');

    });

    it("Second recipient attempts to withdraw more than is available in the balance", async () => {

        withDrawAmount = web3.utils.toWei(web3.utils.toBN(5), "ether");

        await truffleAssert.reverts(
            splitter.withdraw(withDrawAmount, {from: RecipientTwoAddress}),
            "There are insufficient funds"
        );
    });

    it("Second recipient attempts to withdraw zero", async () => {

        await truffleAssert.reverts(
            splitter.withdraw(web3.utils.toBN(0), {from: RecipientTwoAddress}),
            "The value must be greater than 0"
        );
    });

});

