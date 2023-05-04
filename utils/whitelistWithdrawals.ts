import { ethers, network } from "hardhat"
import {
    GOV,
    RESERVES,
    STETH,
    TIMELOCK,
    USDC,
    WHALE_ADDRESS,
    WHALE_ADDRESS_2,
} from "../helper-hardhat-config"
import { IERC20, ITimelock, IYamGovernorAlpha } from "../typechain-types"

export const whitelistWithdrawals = async (proposalAddress: string) => {
    const deployer = (await ethers.getSigners())[0]
    const fundTx = await deployer.sendTransaction({
        to: WHALE_ADDRESS,
        value: ethers.utils.parseEther("100"),
    })
    const fundTx2 = await deployer.sendTransaction({
        to: WHALE_ADDRESS_2,
        value: ethers.utils.parseEther("100"),
    })
    await fundTx.wait(1)
    await fundTx2.wait(1)

    await network.provider.send("hardhat_impersonateAccount", [WHALE_ADDRESS])
    await network.provider.send("hardhat_impersonateAccount", [WHALE_ADDRESS_2])
    const signer = await ethers.getSigner(WHALE_ADDRESS)
    const signer2 = await ethers.getSigner(WHALE_ADDRESS_2)

    const targets = [RESERVES]
    const signatures = ["whitelistWithdrawals(address[],uint256[],address[])"]
    const values = [0]
    const description = "YIP210: implementing a rebalancing framework."

    const whos = [proposalAddress, proposalAddress]
    const amounts = [ethers.constants.MaxUint256, ethers.constants.MaxUint256]
    const tokens = [USDC, STETH]

    const calldatas = [
        ethers.utils.defaultAbiCoder.encode(
            ["address[]", "uint256[]", "address[]"],
            [whos, amounts, tokens]
        ),
    ]

    const gov: IYamGovernorAlpha = await ethers.getContractAt("IYamGovernorAlpha", GOV)
    const govWithSigner: IYamGovernorAlpha = await gov.connect(signer)
    const timelock: ITimelock = await ethers.getContractAt("ITimelock", TIMELOCK)

    // Propose
    const proposeTx = await govWithSigner.propose(
        targets,
        values,
        signatures,
        calldatas,
        description
    )
    await proposeTx.wait(1)

    await mineBlocks(1)

    // Vote
    const id = await govWithSigner.latestProposalIds(signer.address)
    await govWithSigner.castVote(id, true)
    await gov.connect(signer2).castVote(id, true)

    await mineBlocks((await gov.votingPeriod()).toNumber())

    // Queue
    const queueTx = await govWithSigner.queue(id)
    await queueTx.wait(1)

    await network.provider.send("evm_increaseTime", [(await timelock.delay()).toNumber()])
    await mineBlocks(1)

    // Execute
    const executeTx = await govWithSigner.execute(id)
    await executeTx.wait(1)
}

export const mineBlocks = async (blockNumber: number) => {
    while (blockNumber > 0) {
        blockNumber--
        await network.provider.request({
            method: "evm_mine",
            params: [],
        })
    }
}
/*

whitelistWithdrawals("0x0C04D9e9278EC5e4D424476D3Ebec70Cb5d648D1").then(() => {
    console.log("done")
})
*/
