// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { HeldEscrow } from "../src/HeldEscrow.sol";

/// A seller that tries to take twice by calling back in while it is being paid. If I1 is only a
/// convention rather than a property of the code, this drains the contract.
contract ReentrantSeller {
    HeldEscrow public escrow;
    bytes32 public jobId;
    uint256 public reentryAttempts;
    bool public reentryReverted;

    constructor(HeldEscrow e) { escrow = e; }
    function arm(bytes32 id) external { jobId = id; }

    receive() external payable {
        if (reentryAttempts < 3) {
            reentryAttempts++;
            try escrow.expire(jobId) { reentryReverted = false; }
            catch { reentryReverted = true; }
        }
    }
}

/// A seller that refuses payment, to prove a failed transfer does not silently strand a job.
contract RejectingSeller {
    receive() external payable { revert("no thanks"); }
}

contract HeldEscrowTest is Test {
    HeldEscrow escrow;
    address buyer   = address(0xB0B);
    address seller  = address(0x5E11E5);
    address stranger = address(0x57A);
    bytes32 constant JOB = keccak256("job-1");
    uint64  constant WINDOW = 20 minutes;

    function setUp() public {
        escrow = new HeldEscrow();
        vm.deal(buyer, 10 ether);
        vm.deal(stranger, 1 ether);
    }

    function _fund(uint256 amount) internal {
        vm.prank(buyer);
        escrow.fund{ value: amount }(JOB, seller, WINDOW);
    }

    // ── the money ────────────────────────────────────────────────────────────
    function test_fund_holds_the_exact_amount() public {
        _fund(1 ether);
        (address b, address s, uint256 amt, uint64 dl, HeldEscrow.State st) = escrow.jobOf(JOB);
        assertEq(b, buyer);
        assertEq(s, seller);
        assertEq(amt, 1 ether);
        assertEq(dl, uint64(block.timestamp) + WINDOW);
        assertEq(uint8(st), uint8(HeldEscrow.State.Held));
        assertEq(address(escrow).balance, 1 ether);
    }

    function test_approve_pays_the_seller_in_full() public {
        _fund(1 ether);
        vm.prank(buyer);
        escrow.approve(JOB);
        assertEq(seller.balance, 1 ether);
        assertEq(address(escrow).balance, 0);
    }

    function test_reject_refunds_the_buyer_in_full() public {
        _fund(1 ether);
        uint256 before = buyer.balance;
        vm.prank(buyer);
        escrow.reject(JOB);
        assertEq(buyer.balance, before + 1 ether);
        assertEq(seller.balance, 0);
        assertEq(address(escrow).balance, 0);
    }

    // ── partial release, the thing the account escrow could not do ───────────
    function test_settle_splits_and_leaves_nothing_behind() public {
        _fund(1 ether);
        uint256 before = buyer.balance;
        vm.prank(buyer);
        escrow.settle(JOB, 0.6 ether);
        assertEq(seller.balance, 0.6 ether);
        assertEq(buyer.balance, before + 0.4 ether);
        assertEq(address(escrow).balance, 0, "escrow must never retain dust");
    }

    function testFuzz_settle_conserves_the_amount(uint96 amount, uint96 toSeller) public {
        amount = uint96(bound(amount, 1, 5 ether));
        toSeller = uint96(bound(toSeller, 0, amount));
        vm.prank(buyer);
        escrow.fund{ value: amount }(JOB, seller, WINDOW);
        uint256 b0 = buyer.balance;
        vm.prank(buyer);
        escrow.settle(JOB, toSeller);
        assertEq(seller.balance, toSeller);
        assertEq(buyer.balance, b0 + (amount - toSeller));
        assertEq(address(escrow).balance, 0);
    }

    function test_settle_cannot_exceed_the_amount() public {
        _fund(1 ether);
        vm.prank(buyer);
        vm.expectRevert(HeldEscrow.SplitMustEqualAmount.selector);
        escrow.settle(JOB, 1 ether + 1);
    }

    // ── I5: only the buyer who paid may decide ───────────────────────────────
    function test_stranger_cannot_approve() public {
        _fund(1 ether);
        vm.prank(stranger);
        vm.expectRevert(HeldEscrow.NotTheBuyer.selector);
        escrow.approve(JOB);
    }

    function test_seller_cannot_approve_its_own_job() public {
        _fund(1 ether);
        vm.prank(seller);
        vm.expectRevert(HeldEscrow.NotTheBuyer.selector);
        escrow.approve(JOB);
    }

    function test_stranger_cannot_settle() public {
        _fund(1 ether);
        vm.prank(stranger);
        vm.expectRevert(HeldEscrow.NotTheBuyer.selector);
        escrow.settle(JOB, 1);
    }

    // ── I4: silence is not a veto, and does not depend on us ─────────────────
    function test_expire_is_too_early_before_the_deadline() public {
        _fund(1 ether);
        vm.expectRevert(HeldEscrow.TooEarly.selector);
        escrow.expire(JOB);
    }

    function test_anyone_can_expire_after_the_deadline() public {
        _fund(1 ether);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(stranger);                     // not the buyer, not the seller, not us
        escrow.expire(JOB);
        assertEq(seller.balance, 1 ether, "a quiet buyer cannot trap the seller's money");
        assertEq(address(escrow).balance, 0);
    }

    /// The deadline OPENS the permissionless window. It does not CLOSE the buyer's.
    /// A buyer who is still watching can reject at deadline + 1 and take a full refund, so long
    /// as nobody has called `expire` yet. This is deliberate, and the alternative is worse: a hard
    /// cutoff on the buyer would strand funds forever whenever a seller refuses payment, since
    /// `expire` reverts in that case too (see the test below). The seller is never without
    /// recourse, because the seller can call `expire` itself the second the deadline passes.
    /// Pinned here so the behaviour is a decision rather than an accident.
    function test_the_buyer_can_still_reject_after_the_deadline_until_someone_expires() public {
        _fund(1 ether);
        vm.warp(block.timestamp + WINDOW + 1);

        vm.prank(buyer);
        escrow.reject(JOB);
        assertEq(buyer.balance, 10 ether, "a late reject still refunds in full");
        assertEq(seller.balance, 0);

        vm.expectRevert(HeldEscrow.AlreadySettled.selector);
        escrow.expire(JOB);                     // and the race is settled, not run twice
    }

    /// Anyone includes the seller, which is the reason the window above is safe to leave open.
    function test_the_seller_can_expire_its_own_job_the_moment_the_deadline_passes() public {
        _fund(1 ether);
        vm.warp(block.timestamp + WINDOW);
        vm.prank(seller);
        escrow.expire(JOB);
        assertEq(seller.balance, 1 ether);
    }

    // ── I1: at most one payout, however the recipient behaves ────────────────
    function test_cannot_settle_twice() public {
        _fund(1 ether);
        vm.startPrank(buyer);
        escrow.approve(JOB);
        vm.expectRevert(HeldEscrow.AlreadySettled.selector);
        escrow.approve(JOB);
        vm.expectRevert(HeldEscrow.AlreadySettled.selector);
        escrow.reject(JOB);
        vm.stopPrank();
    }

    function test_approve_then_expire_cannot_double_pay() public {
        _fund(1 ether);
        vm.prank(buyer);
        escrow.approve(JOB);
        vm.warp(block.timestamp + WINDOW);
        vm.expectRevert(HeldEscrow.AlreadySettled.selector);
        escrow.expire(JOB);
        assertEq(seller.balance, 1 ether, "exactly one payout, not two");
    }

    function test_reentrant_seller_cannot_take_twice() public {
        ReentrantSeller bad = new ReentrantSeller(escrow);
        bad.arm(JOB);
        vm.prank(buyer);
        escrow.fund{ value: 1 ether }(JOB, address(bad), WINDOW);
        vm.warp(block.timestamp + WINDOW);

        vm.prank(stranger);
        escrow.expire(JOB);

        assertEq(address(bad).balance, 1 ether, "paid exactly once");
        assertEq(address(escrow).balance, 0, "nothing left to drain");
        assertGt(bad.reentryAttempts(), 0, "the callback must actually have run");
        assertTrue(bad.reentryReverted(), "the re-entrant call must revert, not succeed");
    }

    function test_a_seller_that_refuses_payment_reverts_the_whole_settlement() public {
        RejectingSeller bad = new RejectingSeller();
        vm.prank(buyer);
        escrow.fund{ value: 1 ether }(JOB, address(bad), WINDOW);
        vm.prank(buyer);
        vm.expectRevert(HeldEscrow.TransferFailed.selector);
        escrow.approve(JOB);
        // the job must still be Held, not stranded as Settled with the money still here
        (, , uint256 amt, , HeldEscrow.State st) = escrow.jobOf(JOB);
        assertEq(uint8(st), uint8(HeldEscrow.State.Held));
        assertEq(amt, 1 ether);
        assertEq(address(escrow).balance, 1 ether);
    }

    // ── funding hygiene ──────────────────────────────────────────────────────
    function test_cannot_fund_the_same_job_twice() public {
        _fund(1 ether);
        vm.prank(buyer);
        vm.expectRevert(HeldEscrow.JobExists.selector);
        escrow.fund{ value: 1 ether }(JOB, seller, WINDOW);
    }

    function test_cannot_fund_nothing() public {
        vm.prank(buyer);
        vm.expectRevert(HeldEscrow.NothingSent.selector);
        escrow.fund{ value: 0 }(JOB, seller, WINDOW);
    }

    function test_window_must_be_sane() public {
        vm.startPrank(buyer);
        vm.expectRevert(HeldEscrow.BadWindow.selector);
        escrow.fund{ value: 1 ether }(JOB, seller, 0);
        vm.expectRevert(HeldEscrow.BadWindow.selector);
        escrow.fund{ value: 1 ether }(JOB, seller, 31 days);
        vm.stopPrank();
    }

    function test_unknown_job_reverts() public {
        vm.prank(buyer);
        vm.expectRevert(HeldEscrow.NoSuchJob.selector);
        escrow.approve(keccak256("never funded"));
    }
}
