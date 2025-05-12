// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Group7Token {
    string public name = "Group 7";
    string public symbol = "GRP7";
    uint8 public decimals = 18;
    uint256 public _totalSupply;

    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private allowances;

    address public owner;
    uint256 public constant MAX_SALE_PERCENT = 50;
    uint256 public constant PRICE_TIER1 = 5 ether;
    uint256 public constant PRICE_TIER2 = 10 ether;
    uint256 public immutable saleStartTime;
    uint256 public constant SALE_DURATION = 30 days;

    // tracked in 10^18 units
    uint256 public totalSold;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TokensPurchased(address indexed buyer, uint256 amount, uint256 price);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(uint256 _initialSupply) {
        owner = msg.sender;
        _totalSupply = _initialSupply * (10 ** decimals);
        balances[owner] = _totalSupply;
        saleStartTime = block.timestamp;

        // ERC-20 mint event
        emit Transfer(address(0), owner, _totalSupply);
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balances[msg.sender] >= amount, "Insufficient");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function allowance(address tokenOwner, address spender) external view returns (uint256) {
        return allowances[tokenOwner][spender];
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool) {
        require(balances[from] >= amount, "Insufficient");
        require(allowances[from][msg.sender] >= amount, "Not allowed");
        allowances[from][msg.sender] -= amount;
        balances[from] -= amount;
        balances[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    /// @notice Purchase up to 50% of supply at tiered pricing, sale ends in 30 days.
    function buyTokens() public payable {
        require(block.timestamp <= saleStartTime + SALE_DURATION, "Sale ended");

        uint256 maxSale = (_totalSupply * MAX_SALE_PERCENT) / 100;
        require(totalSold < maxSale, "All tokens sold");

        // Determine price tier
        uint256 price = totalSold < (maxSale / 2) ? PRICE_TIER1 : PRICE_TIER2;

        // Whole tokens they want
        uint256 tokensToBuy = msg.value / price;
        require(tokensToBuy > 0, "Insufficient ETH sent");

        // Scaled amount
        uint256 scaled = tokensToBuy * (10 ** decimals);

        // Cap at remaining
        if (totalSold + scaled > maxSale) {
            scaled = maxSale - totalSold;
            tokensToBuy = scaled / (10 ** decimals);
        }

        require(balances[owner] >= scaled, "Not enough tokens");

        // Refund any dust ETH
        uint256 cost = tokensToBuy * price;
        if (msg.value > cost) {
            payable(msg.sender).transfer(msg.value - cost);
        }

        // Execute sale
        balances[owner] -= scaled;
        balances[msg.sender] += scaled;
        totalSold += scaled;

        emit Transfer(owner, msg.sender, scaled);
        emit TokensPurchased(msg.sender, tokensToBuy, price);
    }

    /// @notice Allow plain ETH transfers to purchase tokens
    receive() external payable {
        buyTokens();
    }

    /// @notice Owner can withdraw all collected ETH
    function withdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
}
