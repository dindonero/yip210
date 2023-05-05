import { RESERVES, STETH, USDC } from "../helper-hardhat-config";
import { ethers } from "hardhat";


export const callExecute = async(proposalAddress: string) : Promise<[string, number, string, string]> => {

  const targets = proposalAddress
  const signatures = "execute()"
  const values = 0

  const calldatas = "0x"

  return [targets, values, signatures, calldatas]
}