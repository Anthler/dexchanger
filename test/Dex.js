const {expectRevert, expectEvent} = require('@openzeppelin/test-helpers');
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const Dai = artifacts.require("mocks/Dai.sol");
const Rep = artifacts.require("mocks/Rep.sol");
const Zrx = artifacts.require("mocks/Zrx.sol");
const Bat = artifacts.require("mocks/Bat.sol");
const Dex = artifacts.require("Dex.sol");

contract("Dex", (accounts) => {
    let dai, zrx, rep, bat, dex;
    const [trader1, trader2] = [accounts[1], accounts[2]]
    const [DAI, BAT, REP, ZRX] = ['DAI', 'BAT', 'REP', 'ZRX']
        .map(ticker => web3.utils.fromAscii(ticker));

    beforeEach(async () => {
        ([dai, zrx, bat, rep] = await Promise.all([
            Dai.new(),
            Zrx.new(),
            Bat.new(),
            Rep.new()
        ]));
        dex = await Dex.new();
        await Promise.all([
            dex.addToken(DAI, dai.address),
            dex.addToken(ZRX, zrx.address),
            dex.addToken(BAT, bat.address),
            dex.addToken(REP, rep.address)
        ])

        const amount = web3.utils.toWei('1000');

        const seedTokenBalance = async (token, trader) => {
            await token.faucet(trader,amount);
            await token.approve(
                dex.address, 
                amount, 
                {from: trader}
            ) 
        }
        await Promise.all(
            [dai, zrx, bat, rep].map(
                token => seedTokenBalance(token, trader1)
            )
        )
        await Promise.all(
            [dai, zrx, bat, rep].map(
                token => seedTokenBalance(token, trader2)
            )
        )
    })

    describe("deposit", () => {
        it("Should deposit tokens", async () => {
            const amount = web3.utils.toWei("100");
            await dex.deposit(DAI, amount, {from: trader1});
            const balance = await dex.traderBalances(trader1, DAI);
            assert(balance.toString() === amount)
        })

        it("Should not deposit tokens", async () => {
            await expectRevert.unspecified(
                dex.deposit(
                web3.utils.fromAscii("INVALID-TOKEN"), 
                web3.utils.toWei("100"), 
                {from: trader1})
              ),
              "token does not exist"
        })
     })

});