// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @title HeldEscrow
/// @notice Escrow for agent work, where release is enforced by this contract rather than by the
///         service behaving correctly.
///
/// The account-based escrow this replaces works, and every ending is proven on chain, but it has an
/// honest weakness that is written up in evidence/INVARIANTS.md: the operator holds the escrow key,
/// so a buyer's recourse ultimately depends on us. Here the rules are the code.
///
/// Three properties carry over from the service, and each is enforced below rather than asserted:
///
///   I1  A job pays out at most once. `_take` flips state to Settled before any value moves, so a
///       second call finds the wrong state and reverts. Nothing re-enters into a live job.
///   I4  Silence is not a veto. `expire` is permissionless: once the deadline passes, ANYONE can
///       push the funds to the seller. A seller's money cannot be trapped by a quiet buyer, and it
///       does not depend on our sweeper running, or on us existing.
///   I5  Only the buyer who funded a job may decide it. Approve, reject and settle are restricted
///       to the funder recorded at funding time.
///
/// Two things the account escrow could not do are added:
///
///   Per-job pricing. The amount is whatever the buyer sends. A seller quotes per job instead of
///   being stuck at one flat price.
///
///   Partial release. `settle` splits the held amount between seller and buyer. Real disputes are
///   rarely all-or-nothing, and a full refund is a blunt instrument for work that was half right.
contract HeldEscrow {
    enum State { None, Held, Settled }

    struct Job {
        address buyer;      // the only address permitted to decide
        address seller;     // where an approval sends the money
        uint256 amount;     // held, in tinybar-denominated wei on Hedera's EVM
        uint64  deadline;   // unix seconds; after this, anyone may call expire
        State   state;
    }

    mapping(bytes32 => Job) private _jobs;

    event Funded(bytes32 indexed jobId, address indexed buyer, address indexed seller, uint256 amount, uint64 deadline);
    event Settled(bytes32 indexed jobId, address indexed by, uint256 toSeller, uint256 toBuyer, string reason);

    error JobExists();
    error NoSuchJob();
    error AlreadySettled();
    error NotTheBuyer();
    error NothingSent();
    error BadWindow();
    error TooEarly();
    error SplitMustEqualAmount();
    error TransferFailed();

    /// @notice Fund a job. The value sent IS the price, so pricing is per job.
    /// @param jobId         the service's own job id, hashed; ties an on-chain job to its evidence
    /// @param seller        who gets paid on approval or at the deadline
    /// @param reviewSeconds how long the buyer has to decide
    function fund(bytes32 jobId, address seller, uint64 reviewSeconds) external payable {
        if (msg.value == 0) revert NothingSent();
        if (reviewSeconds == 0 || reviewSeconds > 30 days) revert BadWindow();
        if (seller == address(0)) revert NoSuchJob();
        if (_jobs[jobId].state != State.None) revert JobExists();

        _jobs[jobId] = Job({
            buyer: msg.sender,
            seller: seller,
            amount: msg.value,
            deadline: uint64(block.timestamp) + reviewSeconds,
            state: State.Held
        });
        emit Funded(jobId, msg.sender, seller, msg.value, _jobs[jobId].deadline);
    }

    /// @notice Buyer approves: the seller is paid in full.
    function approve(bytes32 jobId) external {
        Job storage j = _load(jobId);
        if (msg.sender != j.buyer) revert NotTheBuyer();
        _take(jobId, j.amount, 0, "approved by the buyer");
    }

    /// @notice Buyer rejects: the buyer is refunded in full.
    function reject(bytes32 jobId) external {
        Job storage j = _load(jobId);
        if (msg.sender != j.buyer) revert NotTheBuyer();
        _take(jobId, 0, j.amount, "rejected by the buyer");
    }

    /// @notice Buyer splits the held amount. `toSeller` may be zero or the whole amount; the
    ///         remainder always returns to the buyer, so nothing can be stranded by arithmetic.
    function settle(bytes32 jobId, uint256 toSeller) external {
        Job storage j = _load(jobId);
        if (msg.sender != j.buyer) revert NotTheBuyer();
        if (toSeller > j.amount) revert SplitMustEqualAmount();
        _take(jobId, toSeller, j.amount - toSeller, "split by the buyer");
    }

    /// @notice After the deadline, anyone may push the funds to the seller.
    /// @dev Permissionless on purpose. This is what makes "silence is not a veto" a property of the
    ///      contract instead of a promise about our uptime. The caller gets nothing for it.
    function expire(bytes32 jobId) external {
        Job storage j = _load(jobId);
        if (block.timestamp < j.deadline) revert TooEarly();
        _take(jobId, j.amount, 0, "deadline reached, nobody decided");
    }

    function jobOf(bytes32 jobId)
        external
        view
        returns (address buyer, address seller, uint256 amount, uint64 deadline, State state)
    {
        Job storage j = _jobs[jobId];
        return (j.buyer, j.seller, j.amount, j.deadline, j.state);
    }

    function _load(bytes32 jobId) private view returns (Job storage j) {
        j = _jobs[jobId];
        if (j.state == State.None) revert NoSuchJob();
        if (j.state == State.Settled) revert AlreadySettled();
    }

    /// @dev The whole of I1 lives here. State flips to Settled, and the stored amount is zeroed,
    ///      BEFORE either transfer. A re-entrant call re-enters `_load`, finds Settled, and reverts,
    ///      so a job cannot pay out twice however the recipient behaves on receipt.
    function _take(bytes32 jobId, uint256 toSeller, uint256 toBuyer, string memory reason) private {
        Job storage j = _jobs[jobId];
        if (toSeller + toBuyer != j.amount) revert SplitMustEqualAmount();

        address seller = j.seller;
        address buyer = j.buyer;
        j.state = State.Settled;
        j.amount = 0;

        if (toSeller > 0) {
            (bool ok, ) = payable(seller).call{ value: toSeller }("");
            if (!ok) revert TransferFailed();
        }
        if (toBuyer > 0) {
            (bool ok, ) = payable(buyer).call{ value: toBuyer }("");
            if (!ok) revert TransferFailed();
        }
        emit Settled(jobId, msg.sender, toSeller, toBuyer, reason);
    }
}
