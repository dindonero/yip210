import { deployments, ethers } from "hardhat"
import { whitelistWithdrawals as helperWhitelist } from "../utils/whitelistWithdrawals"
import { passProposal } from "../utils/passProposal"

export const whitelistWithdrawals = async () => {
    await deployments.fixture(["YIP210"])
    const YIP210 = await ethers.getContract("YIP210")

    let targets: string[] = []
    let values: number[] = []
    let signatures: string[] = []
    let calldatas: string[] = []

    const description = "YIP210: whitelist proposal"
    const [target, value, signature, calldata] = await helperWhitelist(YIP210.address)
    targets.push(target)
    values.push(value)
    signatures.push(signature)
    calldatas.push(calldata)

    await passProposal(targets, values, signatures, calldatas, description)

    console.log("YIP210 at", YIP210.address)
}

whitelistWithdrawals().then(() => {
    console.log("done")
})
