import { ethers } from "hardhat";
import { YIP210 } from "../typechain-types";


const executeYIP210 = async () => {
  const YIP210: YIP210 = await ethers.getContract("YIP210")

  const tx = await YIP210.execute()
  await tx.wait(1)
}

executeYIP210().then(
  () => {
    console.log("done")
  }
)