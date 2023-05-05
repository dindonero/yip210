# Yam 
### YIP-210 implementing a rebalancing framework.

This YIP-210 simplifies the treasury management to a rebalancing strategy for a portfolio consisting of 70% ETH and 30% USDC, with a rebalancing threshold of 7.5%. This will allow for super low maintaince and minimal on-chain smart contract interactions with the treasury.
Based on backtesting of this strategy, it has proven to provide superior results compared to a buy and hold strategy since 2021, with lower volatility. Longer term buy and hold basis generally out performs but it ultimately depends on at which point did you buy.

More info [here](https://snapshot.org/#/yam.eth/proposal/0xaee9727ec0319e77da7ac49d5e4db631a75fb034aa27748e688c4bfb8458c349).

#### Running the tests

```
yarn install
yarn hardhat node
yarn test --network local
```