import { ethers } from "hardhat"
import {
    RESERVES,
    STETH,
    USDC,
} from "../helper-hardhat-config"

export const whitelistWithdrawals = async (proposalAddress: string) : Promise<[string, number, string, string]> => {

    const targets = RESERVES
    const signatures = "whitelistWithdrawals(address[],uint256[],address[])"
    const values = 0

    const whos = [proposalAddress, proposalAddress]
    const amounts = [ethers.constants.MaxUint256, ethers.constants.MaxUint256]
    const tokens = [USDC, STETH]

    const calldatas =
        ethers.utils.defaultAbiCoder.encode(
            ["address[]", "uint256[]", "address[]"],
            [whos, amounts, tokens]
        )

    return [targets, values, signatures, calldatas]

}