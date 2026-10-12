// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// KitchenShop: the office kitchen's menu and till. Prices live on-chain; a purchase moves exactly the
// item's price from the buyer to the till, authorised by the buyer's own EIP-2612 permit signature,
// so whoever submits the transaction (the Dev Pulse relayer, which pays the gas) cannot spend more.

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract KitchenShop is Ownable {
    using SafeERC20 for IERC20;

    struct Item {
        string name;
        uint256 price;
        bool active;
    }

    /// The coin accepted at the till (PulseCoin).
    IERC20 public immutable coin;
    /// Where payments go: the kitchen's till.
    address public till;

    mapping(uint256 => Item) public items;
    /// Number of purchases so far (purchase ids start at 1).
    uint256 public purchaseCount;

    event ItemListed(uint256 indexed itemId, string name, uint256 price, bool active);
    event Purchased(uint256 indexed purchaseId, address indexed buyer, uint256 indexed itemId, uint256 price);

    error NotOnTheMenu(uint256 itemId);

    constructor(IERC20 coin_, address till_, address owner_) Ownable(owner_) {
        coin = coin_;
        till = till_;
    }

    /// Adds or changes a menu item (price in coin units, 18 decimals).
    function setItem(uint256 itemId, string calldata name, uint256 price, bool active) external onlyOwner {
        items[itemId] = Item(name, price, active);
        emit ItemListed(itemId, name, price, active);
    }

    /**
     * Buys one `itemId` for `buyer`. (v, r, s) is the buyer's permit for exactly the item's price to this
     * shop, valid until `deadline`. Returns the purchase id.
     */
    function buy(address buyer, uint256 itemId, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external returns (uint256 purchaseId) {
        Item storage item = items[itemId];
        if (!item.active) revert NotOnTheMenu(itemId);
        // A permit already submitted by someone else would make this call revert: ignore that case and
        // rely on the allowance check in transferFrom (OpenZeppelin's front-running-safe pattern).
        try IERC20Permit(address(coin)).permit(buyer, address(this), item.price, deadline, v, r, s) {} catch {}
        coin.safeTransferFrom(buyer, till, item.price);
        purchaseId = ++purchaseCount;
        emit Purchased(purchaseId, buyer, itemId, item.price);
    }
}
