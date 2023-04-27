import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const MAINNET_RPC_URL = "https://eth-mainnet.g.alchemy.com/v2/YgoEPqDAT9uhu_SvK4U7j2cJzkwphdd7"

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      forking: {
        url: MAINNET_RPC_URL,
      },
    },
  }
};

export default config;
