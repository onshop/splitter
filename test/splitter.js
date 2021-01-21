const truffleAssert = require('truffle-assertions');
const Splitter = artifacts.require("./Splitter.sol");

contract('Splitter', async accounts => {

    const { toBN } = web3.utils;

    const getGasCost = async receipt => {
        const gasUsed = receipt.receipt.gasUsed;
        const tx = await web3.eth.getTransaction(receipt.tx);
        const gasPrice = tx.gasPrice;

        return toBN(gasUsed * gasPrice);
    };

    const checkEventNotEmitted = async eventName => {
        let result = await truffleAssert.createTransactionResult(splitter, splitter.transactionHash);

        await truffleAssert.eventNotEmitted(
            result,
            eventName
        );
    }

    const senderAddress = accounts[1];
    const RecipientOneAddress = accounts[2];
    const RecipientTwoAddress = accounts[3];
    let splitter;

    beforeEach("deploy and prepare", async function() {
        splitter = await Splitter.new();
    });

    it('Sender sends 5 wei, 4 wei is split equally between recipients and 1 wei sent to the senders balance', async () => {

        // Take snapshot of initial balances
        let initSenderEthBalance = await web3.eth.getBalance(senderAddress);
        initSenderEthBalance = toBN(initSenderEthBalance);

        const initSenderContractBalance = await splitter.balances(senderAddress);
        const initRecipientOneContractBalance = await splitter.balances(RecipientOneAddress);
        const initRecipientTwoContractBalance = await splitter.balances(RecipientTwoAddress);

        // Perform transactions
        const receipt = await splitter.splitDeposit(RecipientOneAddress, RecipientTwoAddress, {from: senderAddress, value: 5});

        const cost = await getGasCost(receipt);
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
        const bobContractBalance = await splitter.balances(RecipientOneAddress);
        const carolContractBalance = await splitter.balances(RecipientTwoAddress);

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
        checkEventNotEmitted("Deposit");
    });

    it("Transaction reverts if the first recipient is the same as the second recipient", async () => {
        await truffleAssert.reverts(
            splitter.splitDeposit(RecipientOneAddress, RecipientOneAddress,{from: senderAddress, value: 4}),
            "The first recipient is the same as the second recipient"
        );
        checkEventNotEmitted("Deposit");
    });

    it("Transaction reverts if the sender's address is also a recipient", async () => {
        await truffleAssert.reverts(
            splitter.splitDeposit(senderAddress, RecipientTwoAddress, {from: senderAddress, value: 4}),
            "The sender cannot also be a recipient"
        );
        checkEventNotEmitted("Deposit");
    });

    it('Second recipient can successfully withdraw 2 wei', async () => {

        const depositAmount = web3.utils.toWei(toBN(1), "ether");
        const withDrawAmount = toBN(2);

        // Take snapshot of the recipients ETH balance
        let initRecipientTwoEthBalance = await web3.eth.getBalance(RecipientTwoAddress);
        initRecipientTwoEthBalance = toBN(initRecipientTwoEthBalance);

        // Deposit into the contract
        await splitter.splitDeposit(RecipientOneAddress, RecipientTwoAddress, {from: senderAddress, value: depositAmount});

        // Take snapshot of the recipients new contract balance
        let initRecipientTwoContractBalance = await splitter.balances(RecipientTwoAddress);
        initRecipientTwoContractBalance = toBN(initRecipientTwoContractBalance)

        // Recipient withdraws
        const receipt = await splitter.withdraw(withDrawAmount, {from: RecipientTwoAddress});
        const cost = await getGasCost(receipt);

        // Get the recipient's new ETH and contract balances
        const carolEthBalance = await web3.eth.getBalance(RecipientTwoAddress);
        const carolContractBalance = await splitter.balances(RecipientTwoAddress);

        // Calculate the expected new ETH and contract balances
        const expectedRecipientTwoEthBalance = initRecipientTwoEthBalance.sub(cost).add(withDrawAmount);
        const expectedRecipientTwoContractBalance = initRecipientTwoContractBalance.sub(withDrawAmount);

        assert.strictEqual(carolEthBalance.toString(10), expectedRecipientTwoEthBalance.toString(10));
        assert.strictEqual(carolContractBalance.toString(10), expectedRecipientTwoContractBalance.toString(10));

        truffleAssert.eventEmitted(receipt, "WithDraw", (ev) => {
            return  ev.withdrawer === RecipientTwoAddress && ev.amount.toString(10) === "2";
        }, 'TestEvent should be emitted with correct parameters');

    });

    it("Second recipient attempts to withdraw more than is available in the balance", async () => {

        withDrawAmount = web3.utils.toWei(toBN(5), "ether");

        await truffleAssert.reverts(
            splitter.withdraw(withDrawAmount, {from: RecipientTwoAddress}),
            "There are insufficient funds"
        );
        checkEventNotEmitted("Withdraw");
    });

    it("Second recipient attempts to withdraw zero", async () => {

        await truffleAssert.reverts(
            splitter.withdraw(toBN(0), {from: RecipientTwoAddress}),
            "The value must be greater than 0"
        );
        checkEventNotEmitted("Withdraw");
    });

});

