import { deployments, ethers, network } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { whitelistWithdrawals } from "../utils/whitelistWithdrawals"
import {
    AggregatorV3Interface,
    IERC20,
    ILido,
    ITimelock,
    IYamGovernorAlpha,
    YIP210,
} from "../typechain-types"
import {
    GOV,
    RESERVES,
    STETH,
    TIMELOCK,
    USDC,
    WETH,
    WHALE_ADDRESS,
    WHALE_ADDRESS_2,
} from "../helper-hardhat-config"
import { expect } from "chai"
import { callExecute } from "../utils/callExecute"
import { mineBlocks, passProposal } from "../utils/passProposal"
import { callDepositWETHIntoStETH } from "../utils/callDepositWETHIntoStETH"

describe("YIP210", function () {
    let YIP210: YIP210
    let deployer: SignerWithAddress
    let priceFeedStETH: AggregatorV3Interface
    let priceFeedUSDC: AggregatorV3Interface

    before(async () => {
        const accounts = await ethers.getSigners()
        deployer = accounts[0]

        await deployments.fixture(["YIP210"])
        YIP210 = await ethers.getContract("YIP210")

        priceFeedStETH = await ethers.getContractAt(
            "AggregatorV3Interface",
            "0xCfE54B5cD566aB89272946F602D76Ea879CAb4a8"
        )
        priceFeedUSDC = await ethers.getContractAt(
            "AggregatorV3Interface",
            "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6"
        )

        let targets: string[] = []
        let values: number[] = []
        let signatures: string[] = []
        let calldatas: string[] = []
        const description = "YIP210: whitelist proposal"

        const [target, value, signature, calldata] = await whitelistWithdrawals(YIP210.address)
        targets.push(target)
        values.push(value)
        signatures.push(signature)
        calldatas.push(calldata)

        await passProposal(targets, values, signatures, calldatas, description)
    })

    it("should rebalance when more diff than 70/30 ratio (sell usdc for steth)", async () => {
        const usdcContract = await ethers.getContractAt("IERC20", USDC)
        const stethContract = await ethers.getContractAt("IERC20", STETH)
        const initUsdcBalanceReserves = await usdcContract.balanceOf(RESERVES)
        const initStethBalanceReserves = await stethContract.balanceOf(RESERVES)

        let targets: string[] = []
        let values: number[] = []
        let signatures: string[] = []
        let calldatas: string[] = []

        const description = "YIP210: rebalacing framework"

        const [target, value, signature, calldata] = await callExecute(YIP210.address)
        targets.push(target)
        values.push(value)
        signatures.push(signature)
        calldatas.push(calldata)

        await passProposal(targets, values, signatures, calldatas, description)

        const finalUsdcBalanceReserves = await usdcContract.balanceOf(RESERVES)
        const finalStethBalanceReserves = await stethContract.balanceOf(RESERVES)

        const stethPrice = (await priceFeedStETH.latestRoundData()).answer
        const usdcPrice = (await priceFeedUSDC.latestRoundData()).answer

        const stethValue = stethPrice
            .div(ethers.BigNumber.from(10).pow(8))
            .mul(finalStethBalanceReserves)
        const usdcValue = usdcPrice
            .mul(ethers.BigNumber.from(10).pow(4))
            .mul(finalUsdcBalanceReserves)

        const ratioStETH_USDC = stethValue.mul(100).div(stethValue.add(usdcValue)).toNumber()
        const ratioUSDC_stETH = usdcValue.mul(100).div(stethValue.add(usdcValue)).toNumber()

        expect(finalUsdcBalanceReserves).to.be.lt(initUsdcBalanceReserves)
        expect(finalStethBalanceReserves).to.be.gt(initStethBalanceReserves)

        expect(ratioUSDC_stETH).to.be.gt(25)
        expect(ratioUSDC_stETH).to.be.lt(35)
        expect(ratioStETH_USDC).to.be.gt(65)
        expect(ratioStETH_USDC).to.be.lt(75)
    })

    it("should not rebalance when less diff than 7.5% diff", async () => {
        await network.provider.send("evm_increaseTime", [2591999])
        await mineBlocks(1)

        let targets: string[] = []
        let values: number[] = []
        let signatures: string[] = []
        let calldatas: string[] = []
        const description = "YIP210: rebalacing framework"

        const [target, value, signature, calldata] = await callExecute(YIP210.address)
        targets.push(target)
        values.push(value)
        signatures.push(signature)
        calldatas.push(calldata)

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

        expect(govWithSigner.execute(id)).to.be.revertedWith(
            "Timelock::executeTransaction: Transaction execution reverted."
        )
    })

    it("should rebalance when more diff than 70/30 ratio (sell steth for usdc)", async () => {
        const stETHContract: ILido = await ethers.getContractAt("ILido", STETH)

        // yam gov owns 458 eth at this time
        const submitTx = await stETHContract.submit(ethers.constants.AddressZero, {
            value: ethers.utils.parseEther("2000"),
        })
        await submitTx.wait(1)

        const transferTx = await stETHContract.transfer(
            RESERVES,
            await stETHContract.balanceOf(deployer.address)
        )
        await transferTx.wait(1)

        const usdcContract = await ethers.getContractAt("IERC20", USDC)
        const stethContract = await ethers.getContractAt("IERC20", STETH)
        const initUsdcBalanceReserves = await usdcContract.balanceOf(RESERVES)
        const initStethBalanceReserves = await stethContract.balanceOf(RESERVES)

        let targets: string[] = []
        let values: number[] = []
        let signatures: string[] = []
        let calldatas: string[] = []
        const description = "YIP210: rebalacing framework"

        const [target, value, signature, calldata] = await callExecute(YIP210.address)
        targets.push(target)
        values.push(value)
        signatures.push(signature)
        calldatas.push(calldata)

        await passProposal(targets, values, signatures, calldatas, description)

        const finalUsdcBalanceReserves = await usdcContract.balanceOf(RESERVES)
        const finalStethBalanceReserves = await stethContract.balanceOf(RESERVES)

        const stethPrice = (await priceFeedStETH.latestRoundData()).answer
        const usdcPrice = (await priceFeedUSDC.latestRoundData()).answer

        const stethValue = stethPrice
            .div(ethers.BigNumber.from(10).pow(8))
            .mul(finalStethBalanceReserves)
        const usdcValue = usdcPrice
            .mul(ethers.BigNumber.from(10).pow(4))
            .mul(finalUsdcBalanceReserves)

        const ratioStETH_USDC = stethValue.mul(100).div(stethValue.add(usdcValue)).toNumber()
        const ratioUSDC_stETH = usdcValue.mul(100).div(stethValue.add(usdcValue)).toNumber()

        expect(finalUsdcBalanceReserves).to.be.gt(initUsdcBalanceReserves)
        expect(finalStethBalanceReserves).to.be.lt(initStethBalanceReserves)

        expect(ratioUSDC_stETH).to.be.gt(25)
        expect(ratioUSDC_stETH).to.be.lt(35)
        expect(ratioStETH_USDC).to.be.gt(65)
        expect(ratioStETH_USDC).to.be.lt(75)
    })

    it("should deposit all WETH from Reserves into STETH", async () => {
        const stethContract = await ethers.getContractAt("IERC20", STETH)
        const wethContract = await ethers.getContractAt("IERC20", WETH)

        let targets: string[] = []
        let values: number[] = []
        let signatures: string[] = []
        let calldatas: string[] = []

        const description = "YIP210: depositing weth into steth"
        const [target, value, signature, calldata] = await callDepositWETHIntoStETH(YIP210.address)
        targets.push(target)
        values.push(value)
        signatures.push(signature)
        calldatas.push(calldata)

        await passProposal(targets, values, signatures, calldatas, description)

        const finalStethBalanceReserves = await stethContract.balanceOf(RESERVES)
        const finalWethBalanceReserves = await wethContract.balanceOf(RESERVES)

        expect(finalStethBalanceReserves).to.be.gt(0)
        expect(finalWethBalanceReserves).to.be.eq(0)
    })
})
