import { ethers, network } from 'hardhat'
export const whitelistWithdrawals = async (proposalAddress: string) => {

  const WHALE_ADDRESS = ""

  const governance = await ethers.getContract('Governance')

  await network.provider.send("hardhat_impersonateAccount", [WHALE_ADDRESS])
  const signer = await ethers.getSigner(WHALE_ADDRESS)
}