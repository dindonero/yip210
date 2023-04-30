import { deployments, ethers, network } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

describe("YIP210", function () {
    let YIP210: any
    let deployer: SignerWithAddress

    beforeEach(async () => {
        const accounts = await ethers.getSigners()
        deployer = accounts[0]

        await deployments.fixture(["YIP210"])
        YIP210 = await ethers.getContract("YIP210")

        // Whitelist Withdrawals

    })

    it("should rebalance when more diff than 70/30 ratio", async () => {

    })
})
