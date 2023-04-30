//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

interface ICurveRouter {
    function exchange_multiple(
        address[9] memory _route,
        uint256[3][4] memory _swap_params,
        uint256 _amount,
        uint256 _expected
    ) external returns (uint256);
}
