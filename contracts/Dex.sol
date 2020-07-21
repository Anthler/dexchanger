pragma solidity 0.6.5;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract Dex{
    
    using SafeMath for uint256;
    
    struct Token{
        bytes32 ticker;
        address tokenAddress;
    }
    
    bytes32 constant DAI = bytes32("DAI");
    mapping(bytes32 => Token) public tokens;
    bytes32[] public tokenList;
    address public admin;
    mapping(address => mapping( bytes32 => uint )) public traderBalances;
    mapping(bytes32 => mapping(uint => Order[])) public orderBook;
    uint public nextOrderId;
    uint public nextTradeId;
    
    enum Side{
        BUY,
        SELL
    }
    
    event NewTrade(
        uint tradeId,
        uint orderId,
        bytes32 indexed ticker,
        address indexed trader1,
        address indexed trader2,
        uint amount,
        uint price,
        uint date
    );
    
    struct Order{
        uint id;
        Side side;
        address trader;
        bytes32 ticker;
        uint amount;
        uint filled;
        uint price;
        uint timestamp;
    }
    
    constructor() public {
        admin = msg.sender;
    }
    
    modifier onlyAdmin(){
        require(msg.sender == admin, "only admin");
        _;
    }
    
    modifier tokenExists(bytes32 _ticker){
        require(tokens[_ticker].tokenAddress != address(0), "token does not exist");
        _;
    }
    
    function addToken(bytes32 _ticker, address _tokenAddress) onlyAdmin() external {
        tokens[_ticker] = Token(_ticker, _tokenAddress);
        tokenList.push(_ticker);
    }
    
    function deposit(bytes32 _ticker, uint _amount) tokenExists(_ticker) external {
        IERC20(tokens[_ticker].tokenAddress).transferFrom(msg.sender, address(this), _amount);
        traderBalances[msg.sender][_ticker] = traderBalances[msg.sender][_ticker].add(_amount);
    }
    
    function withdraw(bytes32 _ticker, uint _amount) tokenExists(_ticker) external {
        require(traderBalances[msg.sender][_ticker] >= _amount, "Insufficient balance");
        traderBalances[msg.sender][_ticker] = traderBalances[msg.sender][_ticker].add(_amount);
        IERC20(tokens[_ticker].tokenAddress).transfer(msg.sender, _amount);
        
    }
    
    modifier tokenIsNotDai(bytes32 _ticker){
        require(_ticker != DAI, "cannot trade dai");
        _;
    }
    
    function createLimitOrder(
        bytes32 _ticker ,
        uint _amount, 
        uint _price, 
        Side _side
    ) 
    tokenExists(_ticker) 
    tokenIsNotDai(_ticker)
    external
    {
        if(_side == Side.SELL){
            require(traderBalances[msg.sender][_ticker] >= _amount, "you must have enough dai");
        }else{
            require(traderBalances[msg.sender][DAI] >= _amount.mul(_price), "dai balance low");
            Order[] storage orders = orderBook[_ticker][uint(_side)];
            orders.push(Order(nextOrderId, _side, msg.sender, _ticker, _amount, 0, _price, now));
            
            uint i = orders.length > 0 ? orders.length - 1 : 0;
            while(i > 0){
                if(_side == Side.BUY && orders[i-1].price > orders[i].price){
                    break;
                }
                
                if(_side == Side.SELL && orders[i-1].price < orders[i].price){
                    break;
                }
                
                Order memory order = orders[i - 1];
                orders[i - 1] = orders[i];
                orders[i] = order;
                i = i.sub(1);
            }
            nextOrderId = nextOrderId.add(1);
        }
        
    }
    
    function createMarketOrder(
        bytes32 _ticker, 
        uint _amount, 
        Side _side) 
    tokenExists(_ticker) 
    tokenIsNotDai(_ticker) public 
    {
        if(_side == Side.SELL){
            require(traderBalances[msg.sender][_ticker] >= _amount, "token balance is low");
        }
        
        Order[] storage orders = orderBook[_ticker][uint(_side == Side.BUY ? Side.SELL : Side.BUY)];
        uint i;
        uint remaining = _amount;
        
        while( i < orders.length && remaining > 0){
            uint available = orders[i].amount.sub(orders[i].filled);
            uint matched = (remaining > available) ? available : remaining;
            remaining -= remaining.sub(matched);
            orders[i].filled += matched;
            emit NewTrade(
                nextTradeId, 
                nextOrderId, 
                _ticker, 
                orders[i].trader, 
                msg.sender, 
                matched, 
                orders[i].price, 
                now 
            );
            
            if(_side == Side.SELL){
                traderBalances[msg.sender][_ticker] = traderBalances[msg.sender][_ticker].sub(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][DAI].add(matched.mul(orders[i].price));
                traderBalances[orders[i].trader][_ticker] = traderBalances[orders[i].trader][_ticker].add(matched);
                traderBalances[orders[i].trader][DAI] =traderBalances[orders[i].trader][DAI].sub(matched.mul(orders[i].price));
            }
            
            if(_side == Side.BUY){
                require(traderBalances[msg.sender][DAI] >= matched.mul(orders[i].price), "Insufficient DAI tokens");
                traderBalances[msg.sender][_ticker] = traderBalances[msg.sender][_ticker].add(matched);
                traderBalances[msg.sender][DAI] = traderBalances[msg.sender][DAI].sub(matched.mul(orders[i].price));
                traderBalances[orders[i].trader][_ticker] = traderBalances[orders[i].trader][_ticker].sub(matched);
                traderBalances[orders[i].trader][DAI] = traderBalances[orders[i].trader][DAI].add(matched.mul( orders[i].price));
            }
            
            nextTradeId = nextTradeId.add(1);
            i = i.add(1);
        }
        
        i = 0;
        while(i < orders.length && orders[i].filled == orders[i].amount){
            for(uint j = i; j < orders.length - 1; j++){
                orders[j] = orders[j + 1];
            }
            orders.pop();
            i = i.add(1);
        }
    }
    
    function getOrders(bytes32 ticker, Side side) external view returns(Order[] memory) {
        return orderBook[ticker][uint(side)];
    }
    
    function getTokens() external view returns(Token[] memory) {
      Token[] memory _tokens = new Token[](tokenList.length);
      for (uint i = 0; i < tokenList.length; i++) {
        _tokens[i] = Token(
          tokens[tokenList[i]].ticker,
          tokens[tokenList[i]].tokenAddress
        );
      }
      return _tokens;
    }
}