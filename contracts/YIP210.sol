//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

import "./interfaces/ILido.sol";
import "./interfaces/ICurveRouter.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

error YIP210__ExecutionDelayNotReached(uint256 timeToExecute);
error YIP210__MinimumRebalancePercentageNotReached(uint256 percentage, uint256 minimumPercentage);

contract YIP210 {
    IERC20 internal constant WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

    IERC20 internal constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

    ILido internal constant STETH = ILido(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);

    ICurveRouter internal constant CURVE_ROUTER =
        ICurveRouter(0x99a58482BD75cbab83b27EC03CA68fF489b5788f);

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

        (, int256 stEthPrice, , , ) = STETH_USD_PRICE_FEED.latestRoundData();
        (, int256 usdcPrice, , , ) = USDC_USD_PRICE_FEED.latestRoundData();

        uint256 stEthValue = uint256(stEthPrice) * stEthBalance;
        uint256 usdcValue = uint256(usdcPrice) * usdcBalance;

        uint256 totalValue = stEthValue + usdcValue;

        uint256 stEthPercentage = (stEthValue * RATIO_PRECISION_MULTIPLIER) / totalValue;

        uint256 usdcPercentage = (usdcValue * RATIO_PRECISION_MULTIPLIER) / totalValue;

        if (stEthPercentage > RATIO_STETH_USDC) {
            if (stEthPercentage - RATIO_STETH_USDC < MINIMUM_REBALANCE_PERCENTAGE)
                revert YIP210__MinimumRebalancePercentageNotReached(
                    stEthPercentage,
                    MINIMUM_REBALANCE_PERCENTAGE
                );

            uint256 stEthToSwap = ((stEthPercentage - RATIO_STETH_USDC) * stEthBalance) /
                RATIO_PRECISION_MULTIPLIER;
            STETH.transferFrom(RESERVES, address(this), stEthToSwap);

            // Slippage math based on chainlink price feeds with 0.1% slippage tolerance
            uint256 usdcExpected = (stEthToSwap * uint256(stEthPrice)) / uint256(usdcPrice);
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

            uint256 stETHExpected = (usdcToSwap * uint256(usdcPrice)) / uint256(stEthPrice);
            uint256 minAmountOut = stETHExpected -
                ((stETHExpected * SLIPPAGE_TOLERANCE) / RATIO_PRECISION_MULTIPLIER);

            // Setting swap minAmountOut to 0 and ensuring tolerance after depositing ETH to Lido
            swapUSDCtoETH(usdcToSwap, 0);
            uint256 stEthReceived = depositETHToLido();

            // Ensuring slippage tolerance
            require(stEthReceived >= minAmountOut, "YIP210::execute: Slippage tolerance not met");

            emit RebalancedUSDCToStETH(usdcToSwap, stEthReceived);

            STETH.transfer(RESERVES, stEthReceived);
        }

        lastExecuted = block.timestamp;
    }

    function curveSwapStETHToUSDC(uint256 amount, uint256 minAmountOut) internal returns (uint256) {
        address[9] memory route = [
            0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84,
            0xDC24316b9AE028F1497c275EB9192a3Ea0f67022,
            0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE,
            0xD51a44d3FaE010294C616388b506AcdA1bfAAE46,
            0xdAC17F958D2ee523a2206206994597C13D831ec7,
            0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7,
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
            0x0000000000000000000000000000000000000000,
            0x0000000000000000000000000000000000000000
        ];

        uint256[3] memory swap_params_helper = [uint256(0), uint256(0), uint256(0)];
        uint256[3][4] memory swap_params = [swap_params_helper, swap_params_helper, swap_params_helper, swap_params_helper];

        STETH.approve(address(CURVE_ROUTER), STETH.balanceOf(address(this)));
        return CURVE_ROUTER.exchange_multiple(route, swap_params, amount, minAmountOut);
    }

    function swapUSDCtoETH(uint256 amount, uint256 minAmountOut) internal {
        address[9] memory route = [
            0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,
            0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7,
            0xdAC17F958D2ee523a2206206994597C13D831ec7,
            0xD51a44d3FaE010294C616388b506AcdA1bfAAE46,
            0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE,
            0x0000000000000000000000000000000000000000,
            0x0000000000000000000000000000000000000000,
            0x0000000000000000000000000000000000000000,
            0x0000000000000000000000000000000000000000
        ];

        uint256[3] memory swap_params_helper = [uint256(0), uint256(0), uint256(0)];
        uint256[3][4] memory swap_params = [swap_params_helper, swap_params_helper, swap_params_helper, swap_params_helper];

        USDC.approve(address(CURVE_ROUTER), USDC.balanceOf(address(this)));
        CURVE_ROUTER.exchange_multiple(route, swap_params, amount, minAmountOut);
    }

    function depositETHToLido() internal returns (uint256) {
        return STETH.submit{value: address(this).balance}(address(0));
    }
}
