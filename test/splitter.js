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
        let result = await truffleAssert.createTransactionResult(splitter, splitter.transactionHash);

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
        let initSenderEthBalance = await web3.eth.getBalance(senderAddress);
        initSenderEthBalance = toBN(initSenderEthBalance);

        const initSenderContractBalance = await splitter.balances(senderAddress);
        const initRecipientOneContractBalance = await splitter.balances(recipientOneAddress);
        const initRecipientTwoContractBalance = await splitter.balances(recipientTwoAddress);

        // Perform transactions
        const txObj = await splitter.splitDeposit(recipientOneAddress, recipientTwoAddress, {from: senderAddress, value: 5});

        const cost = await getGasCost(txObj);
        const transfer = toBN(5);
        const splitAmount = toBN(2);
        const remainder = toBN(1);

        // Check sender's changed ETH balance
        const expectedSenderEthBalance = initSenderEthBalance.sub(cost).sub(toBN(transfer));
        let aliceEthBalance = await web3.eth.getBalance(senderAddress);
        aliceEthBalance = toBN(aliceEthBalance);

        assert.strictEqual(aliceEthBalance.toString(10), expectedSenderEthBalance.toString(10));

        // Calculate the expected contract balances
        const expectedSenderContractBalance = initSenderContractBalance.add(remainder);
        const expectedRecipientOneContractBalance = initRecipientOneContractBalance.add(splitAmount);
        const expectedRecipientTwoContractBalance = initRecipientTwoContractBalance.add(splitAmount);

        // Get the actual contract balances
        const aliceContractBalance = await splitter.balances(senderAddress);
        const bobContractBalance = await splitter.balances(recipientOneAddress);
        const carolContractBalance = await splitter.balances(recipientTwoAddress);

        assert.strictEqual(aliceContractBalance.toString(10), expectedSenderContractBalance.toString(10));
        assert.strictEqual(bobContractBalance.toString(10), expectedRecipientOneContractBalance.toString(10));
        assert.strictEqual(carolContractBalance.toString(10), expectedRecipientTwoContractBalance.toString(10));

        truffleAssert.eventEmitted(txObj, 'Deposit', (ev) => {
            return  ev.sender === senderAddress && ev.recipient1 === recipientOneAddress &&
                    ev.recipient2 === recipientTwoAddress && ev.amount.toString(10) === "2" &&
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

        // Take snapshot of the recipients ETH balance
        let initRecipientTwoEthBalance = await web3.eth.getBalance(recipientTwoAddress);
        initRecipientTwoEthBalance = toBN(initRecipientTwoEthBalance);

        // Deposit into the contract
        await splitter.splitDeposit(recipientOneAddress, recipientTwoAddress, {from: senderAddress, value: depositAmount});

        // Take snapshot of the recipients new contract balance
        let initRecipientTwoContractBalance = await splitter.balances(recipientTwoAddress);
        initRecipientTwoContractBalance = toBN(initRecipientTwoContractBalance)

        // Recipient withdraws
        const txObj = await splitter.withdraw(withDrawAmount, {from: recipientTwoAddress});
        const cost = await getGasCost(txObj);

        // Get the recipient's new ETH and contract balances
        const carolEthBalance = await web3.eth.getBalance(recipientTwoAddress);
        const carolContractBalance = await splitter.balances(recipientTwoAddress);

        // Calculate the expected new ETH and contract balances
        const expectedRecipientTwoEthBalance = initRecipientTwoEthBalance.sub(cost).add(withDrawAmount);
        const expectedRecipientTwoContractBalance = initRecipientTwoContractBalance.sub(withDrawAmount);

        assert.strictEqual(carolEthBalance.toString(10), expectedRecipientTwoEthBalance.toString(10));
        assert.strictEqual(carolContractBalance.toString(10), expectedRecipientTwoContractBalance.toString(10));

        truffleAssert.eventEmitted(txObj, "WithDraw", (ev) => {
            return  ev.withdrawer === recipientTwoAddress && ev.amount.toString(10) === "2";
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

