import { ethers, network } from "hardhat"
import { ITimelock, IYamGovernorAlpha } from "../typechain-types"
import { GOV, TIMELOCK, WHALE_ADDRESS, WHALE_ADDRESS_2 } from "../helper-hardhat-config"

export const passProposal = async (
    targets: string[],
    values: number[],
    signatures: string[],
    calldatas: string[],
    description: string
) => {
    const deployer = (await ethers.getSigners())[0]

    await network.provider.send("hardhat_impersonateAccount", [WHALE_ADDRESS])
    await network.provider.send("hardhat_impersonateAccount", [WHALE_ADDRESS_2])
    const signer = await ethers.getSigner(WHALE_ADDRESS)
    const signer2 = await ethers.getSigner(WHALE_ADDRESS_2)

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
