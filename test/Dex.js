const {expectRevert, expectEvent} = require('@openzeppelin/test-helpers');
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const balance = require('@openzeppelin/test-helpers/src/balance');
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
    const SIDE = {
        BUY: 0,
        SELL: 1
    }

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

     it("Should withdraw tokens", async () => {
        const amount = web3.utils.toWei("100");
        await dex.deposit(DAI, amount, {from: trader1});
        await dex.withdraw(DAI, amount, {from:trader1});
        const [daiBalance, balance] = await Promise.all([
            dex.traderBalances(trader1, DAI),
            dai.balanceOf(trader1)
        ])
        assert(daiBalance.isZero)
        assert(balance.toString() === web3.utils.toWei("1000"))
     })

     it("should not withdraw tokens if does not exist", async () => {
        await expectRevert.unspecified(
            dex.withdraw(
            web3.utils.fromAscii("INVALID-TOKEN"), 
            web3.utils.toWei("100"), 
            {from: trader1})
          ),
          "token does not exist"
     })

     it("SHould not withdraw tokens if balance is too low", async () => {
        await dex.deposit(DAI, web3.utils.toWei("100"), {from: trader1}); 
        await expectRevert.unspecified(
            dex.withdraw(
            DAI,
            web3.utils.toWei("1000"), 
            {from: trader1})
          ),
          "Insufficient balance"
     })

     it("should create limit order", async () => {
        await dex.deposit(DAI, web3.utils.toWei("100"), {from: trader1}); 
        await dex.createLimitOrder(
            REP,
            web3.utils.toWei("10"),
            10,
            SIDE.BUY,
            {from: trader1}
        );
        let buyOrders = await dex.getOrders(REP, SIDE.BUY);
        let sellOrders = await dex.getOrders(REP, SIDE.SELL);
        assert(buyOrders.length === 1);
        assert(buyOrders[0].trader === trader1)
        assert(buyOrders[0].ticker === web3.utils.padRight(REP, 64));
        assert(buyOrders[0].price === "10")
        assert(buyOrders[0].amount === web3.utils.toWei("10"))
        assert(sellOrders.length === 0)
        
        await dex.deposit(DAI, web3.utils.toWei("200"), {from: trader2}); 
        await dex.createLimitOrder(
            REP,
            web3.utils.toWei("10"),
            11,
            SIDE.BUY,
            {from: trader2}
        );

        buyOrders = await dex.getOrders(REP, SIDE.BUY);
        sellOrders = await dex.getOrders(REP, SIDE.SELL);

        assert(buyOrders.length === 2)
        assert(buyOrders[0].trader === trader2)
        assert(buyOrders[1].trader === trader1)
        assert(buyOrders[0].price === "11");
        assert(sellOrders.length === 0)

        await dex.createLimitOrder(
            REP,
            web3.utils.toWei("10"),
            9,
            SIDE.BUY,
            {from: trader2}
        );
        
        buyOrders = await dex.getOrders(REP, SIDE.BUY);
        sellOrders = await dex.getOrders(REP, SIDE.SELL);
        assert(buyOrders.length === 3)
        assert(buyOrders[0].trader === trader2)
        assert(buyOrders[1].trader === trader1)
        assert(buyOrders[2].trader === trader2)
        assert(buyOrders[2].price === "9");
        assert(sellOrders.length === 0)

     })

});