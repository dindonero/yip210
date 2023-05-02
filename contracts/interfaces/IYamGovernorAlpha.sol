//SPDX-License-Identifier: MIT

pragma solidity ^0.8.18;

interface IYamGovernorAlpha {
    enum ProposalState {
        Pending,
        Active,
        Canceled,
        Defeated,
        Succeeded,
        Queued,
        Expired,
        Executed
    }

    function propose(
        address[] memory targets,
        uint[] memory values,
        string[] memory signatures,
        bytes[] memory calldatas,
        string memory description
    ) external returns (uint256);

    function latestProposalIds(address who) external view returns (uint256);

    function queue(uint256 proposalId) external;

    function execute(uint256 proposalId) external payable;

    function castVote(uint256 proposalId, bool support) external;

    function getPriorVotes(address account, uint256 blockNumber) external returns (uint256);

    function state(uint256 proposalId) external view returns (ProposalState);

    function votingPeriod() external view returns (uint256);
}
