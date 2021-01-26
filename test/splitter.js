const truffleAssert = require('truffle-assertions');
const Splitter = artifacts.require("./Splitter.sol");

contract('Splitter', async accounts => {

    const { toBN, toWei } = web3.utils;

    const getGasCost = async txObj => {
        const gasUsed = txObj.receipt.gasUsed;
        const tx = await web3.eth.getTransaction(txObj.tx);
        const gasPrice = tx.gasPrice;

        return toBN(gasUsed).mul(toBN(gasPrice));
    };

    const checkEventNotEmitted = async () => {
        const result = await truffleAssert.createTransactionResult(splitter, splitter.transactionHash);

        await truffleAssert.eventNotEmitted(
            result
        );
    }

    const [ contractOwnerAddress, sender, recipientOne, recipientTwo] = accounts;
    let splitter;

    beforeEach("deploy and prepare", async function() {
        splitter = await Splitter.new({from: contractOwnerAddress});
    });

    it('Sender sends 5 wei, 4 wei is split equally between recipients and 1 wei sent to the senders balance', async () => {

        // Take snapshot of initial balances
        const initContractEthBalance = toBN(await web3.eth.getBalance(splitter.address));

        // Perform transactions
        const txObj = await splitter.splitDeposit(recipientOne, recipientTwo, {from: sender, value: 5});

        const transfer = toBN(5);

        // Check contract's changed ETH balance
        const expectedContractEthBalance = initContractEthBalance.add(toBN(transfer));
        const contractEthBalance = toBN(await web3.eth.getBalance(splitter.address));

        assert.strictEqual(contractEthBalance.toString(10), expectedContractEthBalance.toString(10));

        // Get the actual contract balances
        const senderOwed = await splitter.balances(sender);
        const recipientOneOwed = await splitter.balances(recipientOne);
        const recipientTwoOwed = await splitter.balances(recipientTwo);

        const splitAmount = toBN(2);
        const remainder = toBN(1);

        assert.strictEqual(senderOwed.toString(10), remainder.toString(10));
        assert.strictEqual(recipientOneOwed.toString(10), splitAmount.toString(10));
        assert.strictEqual(recipientTwoOwed.toString(10), splitAmount.toString(10));

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

        await splitter.pause({from: contractOwnerAddress});

        await truffleAssert.reverts(
            splitter.splitDeposit(recipientTwo, recipientOne,{from: sender, value: 4}),
            "Pausable: paused"
        );
        checkEventNotEmitted();
    });

    it("SplitDeposit is unpausable", async () => {

        await splitter.pause({from: contractOwnerAddress});
        await splitter.unpause({from: contractOwnerAddress});

        const txObj = await splitter.splitDeposit(recipientTwo, recipientOne,{from: sender, value: 5});

        truffleAssert.eventEmitted(txObj, 'Deposit');
    })


    it('Second recipient can successfully withdraw 2 wei', async () => {

        const depositAmount = toBN(5);
        const withDrawAmount = toBN(2);
        
        // Deposit into the contract
        await splitter.splitDeposit(recipientOne, recipientTwo, {from: sender, value: depositAmount});

        // Take a snapshot of the second recipient's ETH balance
        const initRecipientTwoEthBalance = toBN(await web3.eth.getBalance(recipientTwo));

        // Take a snapshot of the second recipient's new contract balance
        const initRecipientTwoOwed = toBN(await splitter.balances(recipientTwo));

        // Recipient withdraws
        const txObj = await splitter.withdraw(withDrawAmount, {from: recipientTwo});
        const cost = await getGasCost(txObj);

        // Get the recipient's new ETH and contract balances
        const recipientTwoEthBalance = toBN(await web3.eth.getBalance(recipientTwo));
        const recipientTwoOwed = toBN(await splitter.balances(recipientTwo));

        // Calculate the expected new ETH and contract balances
        const expectedRecipientTwoEthBalance = initRecipientTwoEthBalance.sub(cost).add(withDrawAmount).toString(10);
        const expectedRecipientTwoOwed = "0";

        assert.strictEqual(recipientTwoEthBalance.toString(10), expectedRecipientTwoEthBalance);
        assert.strictEqual(recipientTwoOwed.toString(10), expectedRecipientTwoOwed);

        truffleAssert.eventEmitted(txObj, "WithDraw", (ev) => {
            return  ev.withdrawer === recipientTwo &&
                    ev.amount.toString(10) === "2";
        }, 'TestEvent should be emitted with correct parameters');

    });

    it("Second recipient attempts to withdraw more than is available in the balance", async () => {

        withDrawAmount = toWei(toBN(5), "ether");

        await truffleAssert.reverts(
            splitter.withdraw(withDrawAmount, {from: recipientTwo}),
            "There are insufficient funds"
        );
        checkEventNotEmitted();
    });

    it("Second recipient attempts to withdraw zero", async () => {

        await truffleAssert.reverts(
            splitter.withdraw(toBN(0), {from: recipientTwo}),
            "The value must be greater than 0"
        );
        checkEventNotEmitted();
    });


    it("Withdraw is pausable", async () => {

        await splitter.pause({from: contractOwnerAddress});

        await truffleAssert.reverts(
            splitter.withdraw(toBN(0), {from: recipientTwo}),
            "Pausable: paused"
        );
        checkEventNotEmitted();
    });

    it("Withdraw is unpausable", async () => {

        splitter.splitDeposit(recipientTwo, recipientOne,{from: sender, value: 4}),

        await splitter.pause({from: contractOwnerAddress});
        await splitter.unpause({from: contractOwnerAddress});

        const txObj = await splitter.withdraw(toBN(2), {from: recipientTwo});

        truffleAssert.eventEmitted(txObj, 'WithDraw');

    });

    it("Contract can only be paused by the owner", async () => {

        await truffleAssert.reverts(
            splitter.pause({from: recipientOne}),
            "The contract can only be paused by the owner"
        );

        await truffleAssert.reverts(
            splitter.unpause({from: recipientOne}),
            "The contract can only be unpaused by the owner"
        );
    });

});

