import { HardhatUserConfig } from "hardhat/config"
import "@typechain/hardhat"
import "@nomiclabs/hardhat-waffle"
import "@nomiclabs/hardhat-etherscan"
import "@nomiclabs/hardhat-ethers"
import "hardhat-gas-reporter"
import "solidity-coverage"
import "hardhat-deploy"

const MAINNET_RPC_URL = "https://eth-mainnet.g.alchemy.com/v2/YgoEPqDAT9uhu_SvK4U7j2cJzkwphdd7"
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""

const config: HardhatUserConfig = {
    solidity: "0.8.18",
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            forking: {
                url: MAINNET_RPC_URL,
                blockNumber: 17153676,
            },
        },
        local: {
            chainId: 31337,
            url: "http://127.0.0.1:8545/",
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
            1: 0,
        },
    },
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },
}

export default config
