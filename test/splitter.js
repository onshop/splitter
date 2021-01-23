const truffleAssert = require('truffle-assertions');
const Splitter = artifacts.require("./Splitter.sol");

contract('Splitter', async accounts => {

    const { toBN, toWei } = web3.utils;

    const getGasCost = async txObj => {
        const gasUsed = txObj.receipt.gasUsed;
        const tx = await web3.eth.getTransaction(txObj.tx);
        const gasPrice = tx.gasPrice;

        return toBN(gasUsed * gasPrice);
    };

    const checkEventNotEmitted = async () => {
        const result = await truffleAssert.createTransactionResult(splitter, splitter.transactionHash);

        await truffleAssert.eventNotEmitted(
            result
        );
    }

    const [ senderAddress, recipientOneAddress, recipientTwoAddress] = accounts;
    let splitter;

    beforeEach("deploy and prepare", async function() {
        splitter = await Splitter.new();
    });

    it('Sender sends 5 wei, 4 wei is split equally between recipients and 1 wei sent to the senders balance', async () => {

        // Take snapshot of initial balances
        const initSenderEthBalance = toBN(await web3.eth.getBalance(senderAddress));
        const initSenderOwed = await splitter.balances(senderAddress);
        const initRecipientOneOwed = await splitter.balances(recipientOneAddress);
        const initRecipientTwoOwed = await splitter.balances(recipientTwoAddress);

        // Perform transactions
        const txObj = await splitter.splitDeposit(recipientOneAddress, recipientTwoAddress, {from: senderAddress, value: 5});

        const cost = await getGasCost(txObj);
        const transfer = toBN(5);
        const splitAmount = toBN(2);
        const remainder = toBN(1);

        // Check sender's changed ETH balance
        const expectedSenderEthBalance = initSenderEthBalance.sub(cost).sub(toBN(transfer));
        const aliceEthBalance = toBN(await web3.eth.getBalance(senderAddress));

        assert.strictEqual(aliceEthBalance.toString(10), expectedSenderEthBalance.toString(10));

        // Calculate the expected contract balances
        const expectedSenderOwed = initSenderOwed.add(remainder);
        const expectedRecipientOneOwed = initRecipientOneOwed.add(splitAmount);
        const expectedRecipientTwoOwed = initRecipientTwoOwed.add(splitAmount);

        // Get the actual contract balances
        const aliceOwed = await splitter.balances(senderAddress);
        const bobOwed = await splitter.balances(recipientOneAddress);
        const carolOwed = await splitter.balances(recipientTwoAddress);

        assert.strictEqual(aliceOwed.toString(10), expectedSenderOwed.toString(10));
        assert.strictEqual(bobOwed.toString(10), expectedRecipientOneOwed.toString(10));
        assert.strictEqual(carolOwed.toString(10), expectedRecipientTwoOwed.toString(10));

        truffleAssert.eventEmitted(txObj, 'Deposit', (ev) => {
            return  ev.sender === senderAddress &&
                    ev.recipient1 === recipientOneAddress &&
                    ev.recipient2 === recipientTwoAddress &&
                    ev.amount.toString(10) === "2" &&
                    ev.remainder.toString(10) === "1";
        }, 'TestEvent should be emitted with correct parameters');
    })

    it("Transaction reverts if the deposit amount is zero", async () => {
        await truffleAssert.reverts(
            splitter.splitDeposit(recipientTwoAddress, recipientOneAddress,{from: senderAddress, value: 0}),
            "The value must be greater than 0"
        );
        checkEventNotEmitted();
    });

    it("Transaction reverts if the first recipient is the same as the second recipient", async () => {
        await truffleAssert.reverts(
            splitter.splitDeposit(recipientOneAddress, recipientOneAddress,{from: senderAddress, value: 4}),
            "The first recipient is the same as the second recipient"
        );
        checkEventNotEmitted();
    });

    it("Transaction reverts if the sender's address is also a recipient", async () => {
        await truffleAssert.reverts(
            splitter.splitDeposit(senderAddress, recipientTwoAddress, {from: senderAddress, value: 4}),
            "The sender cannot also be a recipient"
        );
        checkEventNotEmitted();
    });

    it('Second recipient can successfully withdraw 2 wei', async () => {

        const depositAmount = toWei(toBN(1), "ether");
        const withDrawAmount = toBN(2);

        // Take snapshot of theOwed recipients ETH balance
        const initRecipientTwoEthBalance = toBN(await web3.eth.getBalance(recipientTwoAddress));

        // Deposit into the contract
        await splitter.splitDeposit(recipientOneAddress, recipientTwoAddress, {from: senderAddress, value: depositAmount});

        // Take snapshot of the recipients new contract balance
        const initRecipientTwoOwed = toBN(await splitter.balances(recipientTwoAddress));

        // Recipient withdraws
        const txObj = await splitter.withdraw(withDrawAmount, {from: recipientTwoAddress});
        const cost = await getGasCost(txObj);

        // Get the recipient's new ETH and contract balances
        const carolEthBalance = await web3.eth.getBalance(recipientTwoAddress);
        const carolOwed = await splitter.balances(recipientTwoAddress);

        // Calculate the expected new ETH and contract balances
        const expectedRecipientTwoEthBalance = initRecipientTwoEthBalance.sub(cost).add(withDrawAmount);
        const expectedRecipientTwoOwed = initRecipientTwoOwed.sub(withDrawAmount);

        assert.strictEqual(carolEthBalance.toString(10), expectedRecipientTwoEthBalance.toString(10));
        assert.strictEqual(carolOwed.toString(10), expectedRecipientTwoOwed.toString(10));

        truffleAssert.eventEmitted(txObj, "WithDraw", (ev) => {
            return  ev.withdrawer === recipientTwoAddress &&
                    ev.amount.toString(10) === "2";
        }, 'TestEvent should be emitted with correct parameters');

    });

    it("Second recipient attempts to withdraw more than is available in the balance", async () => {

        withDrawAmount = toWei(toBN(5), "ether");

        await truffleAssert.reverts(
            splitter.withdraw(withDrawAmount, {from: recipientTwoAddress}),
            "There are insufficient funds"
        );
        checkEventNotEmitted();
    });

    it("Second recipient attempts to withdraw zero", async () => {

        await truffleAssert.reverts(
            splitter.withdraw(toBN(0), {from: recipientTwoAddress}),
            "The value must be greater than 0"
        );
        checkEventNotEmitted();
    });

});

