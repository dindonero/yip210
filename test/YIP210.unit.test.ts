import { deployments, ethers, network } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"
import { mineBlocks, whitelistWithdrawals } from "../utils/whitelistWithdrawals";
import { IERC20, YIP210 } from "../typechain-types";
import { RESERVES, STETH, USDC } from "../helper-hardhat-config";
import { expect } from "chai";

describe("YIP210", function () {
    let YIP210: YIP210
    let deployer: SignerWithAddress

    beforeAll(async () => {
        const accounts = await ethers.getSigners()
        deployer = accounts[0]

        await deployments.fixture(["YIP210"])
        YIP210 = await ethers.getContract("YIP210")

        const usdcContract: IERC20 = await ethers.getContractAt("IERC20", USDC)
        if ((await usdcContract.allowance(RESERVES, YIP210.address)).lt(ethers.constants.MaxUint256))
            await whitelistWithdrawals(YIP210.address)
    })

    it("should rebalance when more diff than 70/30 ratio (sell usdc for steth", async () => {
        const usdcContract = await ethers.getContractAt("IERC20", USDC)
        const stethContract = await ethers.getContractAt("IERC20", STETH)
        const initUsdcBalance = await usdcContract.balanceOf(YIP210.address)
        const initUsdcBalanceReserves = await usdcContract.balanceOf(RESERVES)
        const initStethBalance = await stethContract.balanceOf(YIP210.address)
        const initStethBalanceReserves = await stethContract.balanceOf(RESERVES)

        const tx = await YIP210.execute()
        await tx.wait(1)

        const finalUsdcBalance = await usdcContract.balanceOf(YIP210.address)
        const finalUsdcBalanceReserves = await usdcContract.balanceOf(RESERVES)
        const finalStethBalance = await stethContract.balanceOf(YIP210.address)
        const finalStethBalanceReserves = await stethContract.balanceOf(RESERVES)

        console.log("initUsdcBalance", initUsdcBalance.toString())
        console.log("initStethBalanceReserves", initStethBalanceReserves.toString())
        console.log("initStethBalance", initStethBalance.toString())
        console.log("initUsdcBalanceReserves", initUsdcBalanceReserves.toString())
        console.log("finalUsdcBalance", finalUsdcBalance.toString())
        console.log("finalUsdcBalanceReserves", finalUsdcBalanceReserves.toString())
        console.log("finalStethBalance", finalStethBalance.toString())
        console.log("finalStethBalanceReserves", finalStethBalanceReserves.toString())
        console.log("finalReservesUsdcRatio", finalUsdcBalanceReserves.div(finalUsdcBalanceReserves.add(finalStethBalanceReserves)).toString())
        console.log("finalReservesStethRatio", finalStethBalanceReserves.div(finalUsdcBalanceReserves.add(finalStethBalanceReserves)).toString())
    })

    it(("should not rebalance when less diff than 70/30 ratio"), async () => {
        await network.provider.send("evm_increaseTime", [2591999])
        await mineBlocks(1)

        expect(YIP210.execute()).to.be.revertedWith("YIP210__MinimumRebalancePercentageNotReached")
    })

})
