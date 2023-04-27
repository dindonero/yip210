//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";


error YIP210__ExecutionDelayNotReached(uint256 timeToExecute);

contract YIP210 {

    IERC20 internal constant WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    IERC20 internal constant USDC = IERC20(0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48);

    address internal constant WSTETH = 0x0C04D9e9278EC5e4D424476D3Ebec70Cb5d648D1;

    address internal constant RESERVES = 0x97990b693835da58a281636296d2bf02787dea17;

    uint256 public constant RATIO_ETH_USDC = 70;
    uint256 public constant RATIO_USDC_ETH = 30;

    // Chainlink price feeds for ETH and USDC
    AggregatorV3Interface internal constant ETH_PRICE_FEED = AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    AggregatorV3Interface internal constant USDC_PRICE_FEED = AggregatorV3Interface(0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6);

    uint256 public constant EXECUTION_DELAY = (1 days) * 30; // 1 month
    uint256 public lastExecuted;

    function execute() public {
        if (block.timestamp - lastExecuted < EXECUTION_DELAY)
            revert YIP210__ExecutionDelayNotReached(lastExecuted + EXECUTION_DELAY - block.timestamp);
        
        uint256 ethBalance = WETH.balanceOf(RESERVES);
        uint256 usdcBalance = USDC.balanceOf(RESERVES);

        (, int256 ethPrice, , ,) = ETH_PRICE_FEED.latestRoundData();
        (, int256 usdcPrice, , ,) = USDC_PRICE_FEED.latestRoundData();

        uint256 ethValue = uint256(ethPrice) * ethBalance;
        uint256 usdcValue = uint256(usdcPrice) * usdcBalance;

        uint256 totalValue = ethValue + usdcValue;

        uint256 ethPercentage = (ethValue * 100) / totalValue;

        uint256 usdcPercentage = (usdcValue * 100) / totalValue;

        uint256 ethToSwap = (usdcPercentage * ethBalance * RATIO_ETH_USDC) / 10000;

        lastExecuted = block.timestamp;
    }
}