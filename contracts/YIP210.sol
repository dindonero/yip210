//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./interfaces/ILido.sol";
import "./interfaces/ICurvePool.sol";
import "./interfaces/IWETH9.sol";
import "hardhat/console.sol";


import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";

error YIP210__ExecutionDelayNotReached(uint256 timeToExecute);
error YIP210__MinimumRebalancePercentageNotReached(uint256 percentage, uint256 minimumPercentage);

contract YIP210 {

    IWETH9 internal constant WETH = IWETH9(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    IERC20 internal constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

    IERC20 internal constant USDT = IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);

    ILido internal constant STETH = ILido(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);

    ICurvePool internal constant CURVE_USDC_USDT_POOL =
        ICurvePool(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);

    ICurvePool2 internal constant CURVE_USDT_ETH_POOL =
        ICurvePool2(0xD51a44d3FaE010294C616388b506AcdA1bfAAE46);

    ICurvePool internal constant CURVE_ETH_STETH_POOL =
        ICurvePool(0xDC24316b9AE028F1497c275EB9192a3Ea0f67022);

    address internal constant RESERVES = 0x97990B693835da58A281636296D2Bf02787DEa17;

    // STETH = 70% ; USDC = 30%
    uint256 public constant RATIO_STETH_USDC = 7000;
    uint256 public constant RATIO_USDC_STETH = 3000;

    // Max slippage = 0.1% (May fail due to price impact?)
    uint256 public constant SLIPPAGE_TOLERANCE = 10;

    uint256 public constant MINIMUM_REBALANCE_PERCENTAGE = 750;

    uint256 public constant RATIO_PRECISION_MULTIPLIER = 10000;

    // Chainlink price feeds for ETH and USDC
    AggregatorV3Interface internal constant STETH_USD_PRICE_FEED =
        AggregatorV3Interface(0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8);
    AggregatorV3Interface internal constant USDC_USD_PRICE_FEED =
        AggregatorV3Interface(0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6);

    uint256 public constant EXECUTION_DELAY = (1 days) * 30; // 1 month
    uint256 public lastExecuted;

    event RebalancedUSDCToStETH(uint256 stEthSpent, uint256 usdcReceived);
    event RebalancedStETHToUSDC(uint256 usdcSpent, uint256 stEthReceived);

    function execute() public {
        if (block.timestamp - lastExecuted < EXECUTION_DELAY)
            revert YIP210__ExecutionDelayNotReached(
                lastExecuted + EXECUTION_DELAY - block.timestamp
            );

        uint256 stEthBalance = STETH.balanceOf(RESERVES);
        uint256 usdcBalance = USDC.balanceOf(RESERVES);

        uint256 stEthValue = getStETHConversionRate(stEthBalance);
        uint256 usdcValue = getUSDCConversionRate(usdcBalance);

        uint256 totalValue = stEthValue + usdcValue;

        uint256 stEthPercentage = (stEthValue * RATIO_PRECISION_MULTIPLIER) / totalValue;

        uint256 usdcPercentage = (usdcValue * RATIO_PRECISION_MULTIPLIER) / totalValue;

        console.log(STETH.balanceOf(address(this)));
        console.log(USDC.balanceOf(address(this)));
        console.log(address(this).balance);

        console.log(stEthBalance, usdcBalance);
        console.log(stEthValue, usdcValue);
        console.log(totalValue);

        console.log(stEthPercentage);
        console.log(usdcPercentage);

        if (stEthPercentage > RATIO_STETH_USDC) {
            if (stEthPercentage - RATIO_STETH_USDC < MINIMUM_REBALANCE_PERCENTAGE)
                revert YIP210__MinimumRebalancePercentageNotReached(
                    stEthPercentage,
                    MINIMUM_REBALANCE_PERCENTAGE
                );

            console.log(stEthPercentage - RATIO_STETH_USDC);


            uint256 stEthToSwap = ((stEthPercentage - RATIO_STETH_USDC) * stEthBalance) /
                RATIO_PRECISION_MULTIPLIER;
            STETH.transferFrom(RESERVES, address(this), stEthToSwap);

            // Slippage math based on chainlink price feeds with 0.1% slippage tolerance
            // math is = sethValue (with 18 decimals) / usdcPrice (with 18 decimals) * 10⁶ => usdc (with 6 decimals)
            uint256 usdcExpected = getStETHConversionRate(stEthToSwap) * 10**6 / getPrice(USDC_USD_PRICE_FEED);
            uint256 minAmountOut = usdcExpected -
                ((usdcExpected * SLIPPAGE_TOLERANCE) / RATIO_PRECISION_MULTIPLIER);

            uint256 usdcReceived = curveSwapStETHToUSDC(stEthToSwap, minAmountOut);

            emit RebalancedStETHToUSDC(stEthToSwap, usdcReceived);

            USDC.transfer(RESERVES, usdcReceived);
        } else if (usdcPercentage > RATIO_USDC_STETH) {
            if (usdcPercentage - RATIO_USDC_STETH < MINIMUM_REBALANCE_PERCENTAGE)
                revert YIP210__MinimumRebalancePercentageNotReached(
                    usdcPercentage,
                    MINIMUM_REBALANCE_PERCENTAGE
                );

            uint256 usdcToSwap = ((usdcPercentage - RATIO_USDC_STETH) * usdcBalance) /
                RATIO_PRECISION_MULTIPLIER;
            USDC.transferFrom(RESERVES, address(this), usdcToSwap);

            uint256 stETHExpected = (getUSDCConversionRate(usdcToSwap)) / getPrice(STETH_USD_PRICE_FEED);
            uint256 minAmountOut = stETHExpected -
                ((stETHExpected * SLIPPAGE_TOLERANCE) / RATIO_PRECISION_MULTIPLIER);

            swapUSDCtoETH(usdcToSwap);
            depositETHToLido();
            uint256 stEthReceived = STETH.balanceOf(address(this));

            // Ensuring slippage tolerance
            require(stEthReceived >= minAmountOut, "YIP210::execute: Slippage tolerance not met");

            emit RebalancedUSDCToStETH(usdcToSwap, stEthReceived);

            STETH.transfer(RESERVES, stEthReceived);
        }

        lastExecuted = block.timestamp;
    }

    function curveSwapStETHToUSDC(uint256 amount, uint256 minAmountOut) internal returns (uint256) {
        STETH.approve(address(CURVE_ETH_STETH_POOL), amount);
        CURVE_ETH_STETH_POOL.exchange(1, 0, amount, 0);

        uint256 amountETH = address(this).balance;
        CURVE_USDT_ETH_POOL.exchange{value: amountETH}(2, 0, amountETH, 0, true);

        uint256 amountUSDT = USDT.balanceOf(address(this));
        TransferHelper.safeApprove(address(USDT), address(CURVE_USDC_USDT_POOL), amountUSDT);
        CURVE_USDC_USDT_POOL.exchange(2, 1, amountUSDT, minAmountOut);
        return USDC.balanceOf(address(this));
    }

    function swapUSDCtoETH(uint256 amount) internal {
        USDC.approve(address(CURVE_USDC_USDT_POOL), amount);
        CURVE_USDC_USDT_POOL.exchange(1, 2, amount, 0);

        uint256 amountUSDT = USDT.balanceOf(address(this));
        TransferHelper.safeApprove(address(USDT), address(CURVE_USDT_ETH_POOL), amountUSDT);

        console.log("usdc", amount, amountUSDT, address(this).balance);
        CURVE_USDT_ETH_POOL.exchange(0, 2, amountUSDT, 0, true);
        console.log(address(this).balance);
    }

    function depositETHToLido() internal returns (uint256) {
        return STETH.submit{value: address(this).balance}(address(0));
    }

    function getPrice(AggregatorV3Interface priceFeed) internal view returns (uint256) {
        (, int256 answer, , , ) = priceFeed.latestRoundData();
        // ETH/USD rate in 18 digit
        return uint256(answer * 10000000000);
        // or (Both will do the same thing)
        // return uint256(answer * 1e10); // 1* 10 ** 10 == 10000000000
    }

    function getStETHConversionRate(uint256 assetAmount)
    internal
    view
    returns (uint256)
    {
        uint256 assetPrice = getPrice(STETH_USD_PRICE_FEED);
        uint256 assetAmountInUsd = (assetPrice * assetAmount) / 1000000000000000000;
        // or (Both will do the same thing)
        // uint256 ethAmountInUsd = (ethPrice * ethAmount) / 1e18; // 1 * 10 ** 18 == 1000000000000000000
        // the actual ETH/USD conversion rate, after adjusting the extra 0s.
        return assetAmountInUsd;
    }

    function getUSDCConversionRate(uint256 assetAmount)
    internal
    view
    returns (uint256)
    {
        uint256 assetPrice = getPrice(USDC_USD_PRICE_FEED);
        uint256 assetAmountInUsd = (assetPrice * assetAmount) / 1000000;
        // or (Both will do the same thing)
        // uint256 usdcAmountInUsd = (usdcPrice * usdcAmount) / 1e6; // 1 * 10 ** 6 == 1000000
        // the actual USDC/USD conversion rate, after adjusting the extra 0s.
        return assetAmountInUsd;
    }

    receive() external payable {}
}