const truffleAssert = require('truffle-assertions');
const Splitter = artifacts.require("./Splitter.sol");

contract('Splitter', async accounts => {

    const aliceAddress = '0xA2aDe56e2c69589eaFA636C845b296718D5766fd';
    const bobAddress = '0x20601F1Ddb44E28b1511EdBD316A368D80116408';
    const carolAddress = '0x24F1500890505ceD8534502ab403F20ce99feea0';
    let splitter;

    beforeEach("deploy and prepare", async function() {
        splitter = await Splitter.deployed();
    });

    it('Alice sends 5 wei, 4 wei is split equally between recipients and 1 wei change refunded', async () => {

        let initAliceBalance = await web3.eth.getBalance(aliceAddress);
        let initBobBalance = await web3.eth.getBalance(bobAddress);
        let initCarolBalance = await web3.eth.getBalance(carolAddress);

        const receipt = await splitter.splitFunds(bobAddress, carolAddress, {from: aliceAddress, value: 5});

        const gasUsed = receipt.receipt.gasUsed;
        const tx = await web3.eth.getTransaction(receipt.tx);
        const gasPrice = tx.gasPrice;
        const cost = gasUsed * gasPrice;

        let aliceBalance = await web3.eth.getBalance(aliceAddress);
        let bobBalance = await web3.eth.getBalance(bobAddress);
        let carolBalance = await web3.eth.getBalance(carolAddress);

        assert.equal(parseInt(aliceBalance), parseInt(initAliceBalance) - (cost + 4));
        assert.equal(parseInt(bobBalance), parseInt(initBobBalance) + 2);
        assert.equal(parseInt(carolBalance), parseInt(initCarolBalance) + 2);

        truffleAssert.eventNotEmitted(receipt, 'Deposit', (ev) => {
            return  ev.sender === aliceAddress && ev.recipient1 === bobAddress && ev.recipient2 === carolAddress && ev.amount === 2 && ev.remainder === 1;
        }, 'TestEvent should be emitted with correct parameters');
    });

    it("Transaction reverts if the first recipient is the same as the second recipient", async () => {
        await truffleAssert.reverts(
            splitter.splitFunds(bobAddress, bobAddress,{from: aliceAddress, value: 4}),
            "The first recipient is the same as the second recipient"
        );
    });

    it("Transaction reverts if the sender's address is also a recipient", async () => {
        await truffleAssert.reverts(
            splitter.splitFunds(aliceAddress, carolAddress, {from: aliceAddress, value: 4}),
            "The sender cannot also be a recipient"
        );
    });
});