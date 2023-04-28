//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./interfaces/ILido.sol";
import "./interfaces/ICurvePool.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";


error YIP210__ExecutionDelayNotReached(uint256 timeToExecute);
error YIP210__MinimumRebalancePercentageNotReached(uint256 percentage, uint256 minimumPercentage);


contract YIP210 {

    IERC20 internal constant WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    IERC20 internal constant USDC = IERC20(0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48);

    ILido internal constant STETH = ILido(0x0C04D9e9278EC5e4D424476D3Ebec70Cb5d648D1);

    ICurvePool internal constant CURVE_POOL = ICurvePool(0xDC24316b9AE028F1497c275EB9192a3Ea0f67022);

    address internal constant RESERVES = 0x97990b693835da58a281636296d2bf02787dea17;

    uint256 public constant RATIO_STETH_USDC = 7000;
    uint256 public constant RATIO_USDC_STETH = 3000;

    uint256 public constant MINIMUM_REBALANCE_PERCENTAGE = 750;

    uint256 public constant RATIO_PRECISION_MULTIPLIER = 10000;

    // Chainlink price feeds for ETH and USDC
    AggregatorV3Interface internal constant STETH_USD_PRICE_FEED = AggregatorV3Interface(0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8);
    AggregatorV3Interface internal constant USDC_USD_PRICE_FEED = AggregatorV3Interface(0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6);

    uint256 public constant EXECUTION_DELAY = (1 days) * 30; // 1 month
    uint256 public lastExecuted;

    function execute() public {
        if (block.timestamp - lastExecuted < EXECUTION_DELAY)
            revert YIP210__ExecutionDelayNotReached(lastExecuted + EXECUTION_DELAY - block.timestamp);

        uint256 stEthBalance = STETH.balanceOf(RESERVES);
        uint256 usdcBalance = USDC.balanceOf(RESERVES);

        (, int256 stEthPrice, , ,) = STETH_USD_PRICE_FEED.latestRoundData();
        (, int256 usdcPrice, , ,) = USDC_USD_PRICE_FEED.latestRoundData();

        uint256 stEthValue = uint256(stEthPrice) * stEthBalance;
        uint256 usdcValue = uint256(usdcPrice) * usdcBalance;

        uint256 totalValue = stEthValue + usdcValue;

        uint256 stEthPercentage = (stEthValue * RATIO_PRECISION_MULTIPLIER) / totalValue;

        uint256 usdcPercentage = (usdcValue * RATIO_PRECISION_MULTIPLIER) / totalValue;

        if (stEthPercentage > RATIO_STETH_USDC) {
            if (stEthPercentage - RATIO_STETH_USDC < MINIMUM_REBALANCE_PERCENTAGE)
                revert YIP210__MinimumRebalancePercentageNotReached(stEthPercentage, MINIMUM_REBALANCE_PERCENTAGE);

            uint256 stEthToSwap = (stEthPercentage - RATIO_STETH_USDC) * ethBalance / RATIO_PRECISION_MULTIPLIER;
            STETH.transferFrom(RESERVES, WSTETH, stEthToSwap);

            curveSwap();

        } else if (usdcPercentage > RATIO_USDC_ETH) {
            uint256 usdcToSwap = (usdcPercentage - RATIO_USDC_ETH) * usdcBalance / RATIO_PRECISION_MULTIPLIER;
            USDC.transfer(WSTETH, usdcToSwap);
        }

        lastExecuted = block.timestamp;
    }


    function curveSwapStETHToETH() {
        STETH.approve(CURVE_POOL, STETH.balanceOf(this));
        CURVE_POOL.exchange(1, 0, STETH.balanceOf(this), 0);
    }

    function swapETHToUSDC() {
    }

    function swapUSDCtoSTETH() {
        // swap USDC to ETH
        STETH.submit{value: address(this).balance}();
    }
}