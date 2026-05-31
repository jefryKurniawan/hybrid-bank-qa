// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockUSDC
 * @notice Mock USDC (ERC20) for Hybrid Banking QA testing
 * @dev Implements standard ERC20 + mint/burn (owner-only) + nonce tracking
 *
 * Features:
 * - Standard ERC20 (transfer, transferFrom, approve, balanceOf, allowance)
 * - mint(address, amount) — owner-only, simulates bank issuing USDC
 * - burn(address, amount) — owner-only
 * - _nonces mapping — prevents double-spend via nonce tracking
 * - Transfer events on every balance change (FR7)
 * - 6 decimals (same as real USDC)
 */
contract MockUSDC {
    // ERC20 public state
    string public name = "Mock USDC";
    string public symbol = "USDC";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;

    // Owner (bank) address
    address public owner;

    // ERC20 mappings
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // Nonce tracking for double-spend prevention (FR10)
    mapping(address => uint256) public nonces;

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);

    // Errors
    error OwnableUnauthorizedAccount(address account);
    error InsufficientBalance(uint256 available, uint256 required);
    error InsufficientAllowance(uint256 available, uint256 required);
    error InvalidAddress();
    error ZeroAmount();

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ============ ERC20 Standard Functions (FR6) ============

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        if (_balances[msg.sender] < amount) revert InsufficientBalance(_balances[msg.sender], amount);

        _balances[msg.sender] -= amount;
        _balances[to] += amount;

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        if (spender == address(0)) revert InvalidAddress();

        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function allowance(address tokenOwner, address spender) public view returns (uint256) {
        return _allowances[tokenOwner][spender];
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        if (_balances[from] < amount) revert InsufficientBalance(_balances[from], amount);
        if (_allowances[from][msg.sender] < amount) revert InsufficientAllowance(_allowances[from][msg.sender], amount);

        _balances[from] -= amount;
        _balances[to] += amount;
        _allowances[from][msg.sender] -= amount;

        emit Transfer(from, to, amount);
        return true;
    }

    // ============ Mint / Burn (FR8) ============

    /**
     * @notice Mint USDC to an address — only owner (bank) can call (FR8)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();

        totalSupply += amount;
        _balances[to] += amount;

        emit Mint(to, amount);
        emit Transfer(address(0), to, amount);
    }

    /**
     * @notice Burn USDC from an address — only owner can call
     */
    function burn(address from, uint256 amount) external onlyOwner {
        if (from == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();
        if (_balances[from] < amount) revert InsufficientBalance(_balances[from], amount);

        totalSupply -= amount;
        _balances[from] -= amount;

        emit Burn(from, amount);
        emit Transfer(from, address(0), amount);
    }

    // ============ Nonce Functions (FR10) ============

    /**
     * @notice Increment nonce for an address — for double-spend prevention
     * @return The new nonce value
     */
    function incrementNonce(address account) external returns (uint256) {
        nonces[account] += 1;
        return nonces[account];
    }

    /**
     * @notice Get current nonce for an address
     */
    function getNonce(address account) external view returns (uint256) {
        return nonces[account];
    }
}
