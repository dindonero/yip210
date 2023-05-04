import { deployments, ethers, network } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { mineBlocks, whitelistWithdrawals } from "../utils/whitelistWithdrawals";
import { IERC20, ILido, YIP210 } from "../typechain-types";
import { RESERVES, STETH, USDC } from "../helper-hardhat-config";
import { expect } from "chai";

describe("YIP210", function () {
    let YIP210: YIP210
    let deployer: SignerWithAddress

    before(async () => {
        const accounts = await ethers.getSigners()
        deployer = accounts[0]

        await deployments.fixture(["YIP210"])
        YIP210 = await ethers.getContract("YIP210")

        const usdcContract: IERC20 = await ethers.getContractAt("IERC20", USDC)
        if ((await usdcContract.allowance(RESERVES, YIP210.address)).lt(ethers.constants.MaxUint256))
            await whitelistWithdrawals(YIP210.address)
    })

    it("should rebalance when more diff than 70/30 ratio (sell usdc for steth)", async () => {
        const usdcContract = await ethers.getContractAt("IERC20", USDC)
        const stethContract = await ethers.getContractAt("IERC20", STETH)
        const initUsdcBalanceReserves = await usdcContract.balanceOf(RESERVES)
        const initStethBalanceReserves = await stethContract.balanceOf(RESERVES)

        const tx = await YIP210.execute()
        await tx.wait(1)

        const finalUsdcBalanceReserves = await usdcContract.balanceOf(RESERVES)
        const finalStethBalanceReserves = await stethContract.balanceOf(RESERVES)

        console.log("initStethBalanceReserves", initStethBalanceReserves.div(10^18).toString())
        console.log("initUsdcBalanceReserves", initUsdcBalanceReserves.div(10^6).toString())
        console.log("finalUsdcBalanceReserves", finalUsdcBalanceReserves.div(10^6).toString())
        console.log("finalStethBalanceReserves", finalStethBalanceReserves.div(10^18).toString())
    })

    it(("should not rebalance when less diff than 70/30 ratio"), async () => {
        await network.provider.send("evm_increaseTime", [2591999])
        await mineBlocks(1)

        expect(YIP210.execute()).to.be.revertedWith("YIP210__MinimumRebalancePercentageNotReached")
    })

    it(("should rebalance when more diff than 70/30 ratio (sell steth for usdc)"), async () => {

        const stETHContract: ILido = await ethers.getContractAt("ILido", STETH)

        // yam gov owns 458 eth at this time
        const submitTx = await stETHContract.submit(ethers.constants.AddressZero, { value: ethers.utils.parseEther("2000")})
        await submitTx.wait(1)

        const transferTx = await stETHContract.transfer(RESERVES, await stETHContract.balanceOf(deployer.address))
        await transferTx.wait(1)

        const usdcContract = await ethers.getContractAt("IERC20", USDC)
        const stethContract = await ethers.getContractAt("IERC20", STETH)
        const initUsdcBalanceReserves = await usdcContract.balanceOf(RESERVES)
        const initStethBalanceReserves = await stethContract.balanceOf(RESERVES)

        const tx = await YIP210.execute()
        await tx.wait(1)

        const finalUsdcBalanceReserves = await usdcContract.balanceOf(RESERVES)
        const finalStethBalanceReserves = await stethContract.balanceOf(RESERVES)

        console.log("initStethBalanceReserves", initStethBalanceReserves.div(10^18).toString())
        console.log("initUsdcBalanceReserves", initUsdcBalanceReserves.div(10^6).toString())
        console.log("finalUsdcBalanceReserves", finalUsdcBalanceReserves.div(10^6).toString())
        console.log("finalStethBalanceReserves", finalStethBalanceReserves.div(10^18).toString())
    })

})
