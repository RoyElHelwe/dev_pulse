// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// PulseCoin (PULSE): the office currency, spent in the kitchen (KitchenShop).
// Minted only as rewards by the Dev Pulse server (MINTER_ROLE); the daily allowance rule lives here, on-chain.

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

contract PulseCoin is ERC20, ERC20Permit, AccessControl {
    /// Allowed to mint rewards and pay out daily allowances (the Dev Pulse server's account).
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// Paid by claimDaily, at most once per DAILY_PERIOD for each address.
    uint256 public constant DAILY_ALLOWANCE = 5 ether;
    uint256 public constant DAILY_PERIOD = 1 days;

    /// Last daily claim of each address (0: never).
    mapping(address => uint256) public lastDailyClaim;

    /// Coins created for `to`; `reason` says why ("welcome", "task", "game", "grant").
    event Rewarded(address indexed to, uint256 amount, string reason);
    /// A daily allowance was paid; the next one is possible from `nextClaimAt`.
    event DailyClaimed(address indexed to, uint256 amount, uint256 nextClaimAt);

    error DailyAlreadyClaimed(uint256 nextClaimAt);

    constructor(address admin) ERC20("PulseCoin", "PULSE") ERC20Permit("PulseCoin") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    /// Mints `amount` to `to` as a reward.
    function reward(address to, uint256 amount, string calldata reason) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit Rewarded(to, amount, reason);
    }

    /// Pays `to` the daily allowance; reverts when they already claimed in the last DAILY_PERIOD.
    function claimDaily(address to) external onlyRole(MINTER_ROLE) {
        uint256 next = nextDailyClaim(to);
        if (block.timestamp < next) revert DailyAlreadyClaimed(next);
        lastDailyClaim[to] = block.timestamp;
        _mint(to, DAILY_ALLOWANCE);
        emit DailyClaimed(to, DAILY_ALLOWANCE, block.timestamp + DAILY_PERIOD);
    }

    /// When `who` may claim again (0 or a past time: now).
    function nextDailyClaim(address who) public view returns (uint256) {
        uint256 last = lastDailyClaim[who];
        return last == 0 ? 0 : last + DAILY_PERIOD;
    }
}
