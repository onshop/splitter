const truffleAssert = require('truffle-assertions');
const Splitter = artifacts.require("./Splitter.sol");

contract('Splitter', async accounts => {

    const { toBN } = web3.utils;

    const getGasCost = async txObj => {
        const tx = await web3.eth.getTransaction(txObj.tx);

        return toBN(txObj.receipt.gasUsed).mul(toBN(tx.gasPrice));
    };

    const checkEventNotEmitted = async () => {
        const result = await truffleAssert.createTransactionResult(splitter, splitter.transactionHash);

        await truffleAssert.eventNotEmitted(
            result
        );
    };

    const [ contractOwner, sender, recipientOne, recipientTwo] = accounts;
    let splitter;

    beforeEach("deploy and prepare", async function() {
        splitter = await Splitter.new({from: contractOwner});
    });

    it('Sender sends 5 wei, 4 wei is split equally between recipients and 1 wei sent to the senders balance', async () => {

        // Perform transactions
        const txObj = await splitter.splitDeposit(recipientOne, recipientTwo, {from: sender, value: 5});

        // Check contract's changed ETH balance
        const contractEthBalance = toBN(await web3.eth.getBalance(splitter.address));

        assert.strictEqual(contractEthBalance.toString(10), "5");

        // Get the actual contract balances
        const senderOwed = await splitter.balances(sender);
        const recipientOneOwed = await splitter.balances(recipientOne);
        const recipientTwoOwed = await splitter.balances(recipientTwo);

        assert.strictEqual(senderOwed.toString(10), "1");
        assert.strictEqual(recipientOneOwed.toString(10), "2");
        assert.strictEqual(recipientTwoOwed.toString(10), "2");

        truffleAssert.eventEmitted(txObj, 'Deposit', (ev) => {
            return  ev.sender === sender &&
                    ev.recipient1 === recipientOne &&
                    ev.recipient2 === recipientTwo &&
                    ev.amount.toString(10) === "2" &&
                    ev.remainder.toString(10) === "1";
        }, 'TestEvent should be emitted with correct parameters');
    })

    it("Transaction reverts if the deposit amount is zero", async () => {
        await truffleAssert.reverts(
            splitter.splitDeposit(recipientTwo, recipientOne,{from: sender, value: 0}),
            "The value must be greater than 0"
        );
        checkEventNotEmitted();
    });

    it("Transaction reverts if the first recipient is the same as the second recipient", async () => {
        await truffleAssert.reverts(
            splitter.splitDeposit(recipientOne, recipientOne,{from: sender, value: 4}),
            "The first recipient is the same as the second recipient"
        );
        checkEventNotEmitted();
    });

    it("Transaction reverts if the sender's address is also a recipient", async () => {
        await truffleAssert.reverts(
            splitter.splitDeposit(sender, recipientTwo, {from: sender, value: 4}),
            "The sender cannot also be a recipient"
        );
        checkEventNotEmitted();
    });

    it("SplitDeposit is pausable", async () => {

        await splitter.pause({from: contractOwner});

        await truffleAssert.reverts(
            splitter.splitDeposit(recipientTwo, recipientOne,{from: sender, value: 4}),
            "Pausable: paused"
        );
        checkEventNotEmitted();
    });

    it("SplitDeposit is unpausable", async () => {

        await splitter.pause({from: contractOwner});
        await splitter.unpause({from: contractOwner});

        const txObj = await splitter.splitDeposit(recipientTwo, recipientOne,{from: sender, value: 5});

        truffleAssert.eventEmitted(txObj, 'Deposit');
    })


    it('Sender deposits 5 wei and the recipient can successfully withdraw 2 wei', async () => {

        const withDrawAmount = toBN(2);
        
        // Deposit into the contract
        await splitter.splitDeposit(recipientOne, recipientTwo, {from: sender, value: toBN(5)});

        // Take a snapshot of the second recipient's ETH balance
        const initRecipientTwoEthBalance = toBN(await web3.eth.getBalance(recipientTwo));

        // Recipient withdraws
        const txObj = await splitter.withdraw(withDrawAmount, {from: recipientTwo});
        const cost = await getGasCost(txObj);

        // Get the recipient's new ETH and contract balances
        const recipientTwoEthBalance = toBN(await web3.eth.getBalance(recipientTwo));
        const recipientTwoOwed = toBN(await splitter.balances(recipientTwo));

        // Calculate the expected new ETH and contract balances
        const expectedRecipientTwoEthBalance = initRecipientTwoEthBalance.sub(cost).add(withDrawAmount).toString(10);

        assert.strictEqual(recipientTwoEthBalance.toString(10), expectedRecipientTwoEthBalance);
        assert.strictEqual(recipientTwoOwed.toString(10), "0");

        truffleAssert.eventEmitted(txObj, "WithDraw", (ev) => {
            return  ev.withdrawer === recipientTwo &&
                    ev.amount.toString(10) === "2";
        }, 'TestEvent should be emitted with correct parameters');

    });

    it("Second recipient attempts to withdraw 3 wei when there is only 3 wei", async () => {

        await splitter.splitDeposit(recipientOne, recipientTwo, {from: sender, value: toBN(5)});

        await truffleAssert.reverts(
            splitter.withdraw(toBN(3), {from: recipientTwo}),
            "There are insufficient funds"
        );
        checkEventNotEmitted();
    });

    it("Second recipient attempts to withdraw zero", async () => {

        await splitter.splitDeposit(recipientOne, recipientTwo, {from: sender, value: toBN(5)});

        await truffleAssert.reverts(
            splitter.withdraw(toBN(0), {from: recipientTwo}),
            "The value must be greater than 0"
        );
        checkEventNotEmitted();
    });


    it("Withdraw is pausable", async () => {

        await splitter.splitDeposit(recipientTwo, recipientOne,{from: sender, value: 4}),

        await splitter.pause({from: contractOwner});

        await truffleAssert.reverts(
            splitter.withdraw(toBN(2), {from: recipientTwo}),
            "Pausable: paused"
        );
        checkEventNotEmitted();
    });

    it("Withdraw is unpausable", async () => {

        await splitter.splitDeposit(recipientTwo, recipientOne,{from: sender, value: 4}),

        await splitter.pause({from: contractOwner});
        await splitter.unpause({from: contractOwner});

        const txObj = await splitter.withdraw(toBN(2), {from: recipientTwo});

        truffleAssert.eventEmitted(txObj, 'WithDraw');

    });

    it("Contract can only be paused by the owner", async () => {

        await truffleAssert.reverts(
            splitter.pause({from: recipientOne}),
            "Ownable: caller is not the owner"
        );

        await truffleAssert.reverts(
            splitter.unpause({from: recipientOne}),
            "Ownable: caller is not the owner"
        );
    });

});

