export const callDepositWETHIntoStETH = async (
    proposalAddress: string
): Promise<[string, number, string, string]> => {
    const targets = proposalAddress
    const signatures = "depositWETHIntoStETH()"
    const values = 0

    const calldatas = "0x"

    return [targets, values, signatures, calldatas]
}
