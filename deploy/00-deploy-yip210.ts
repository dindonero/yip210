import { DeployFunction } from "hardhat-deploy/types"
import { HardhatRuntimeEnvironment } from "hardhat/types"

const deployYIP210: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    log("Deploying YIP210...")
    await deploy("YIP210", {
        from: deployer,
        log: true,
        args: []
    })

    log("YIP210 Deployed!")
    log("----------------------------------")
}
export default deployYIP210
deployYIP210.tags = ["all", "YIP210"]
