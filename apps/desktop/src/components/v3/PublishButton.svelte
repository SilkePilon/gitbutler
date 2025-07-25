<script lang="ts">
	import CanPublishReviewPlugin from '$components/v3/CanPublishReviewPlugin.svelte';
	import { UiState } from '$lib/state/uiState.svelte';
	import { TestId } from '$lib/testing/testIds';
	import { getContext } from '@gitbutler/shared/context';
	import Button from '@gitbutler/ui/Button.svelte';
	import type { BranchDetails } from '$lib/stacks/stack';

	type Props = {
		projectId: string;
		stackId: string;
		flex?: string;
		branches: BranchDetails[];
		reviewCreationInOpen?: boolean;
	};

	const { projectId, stackId, flex, branches, reviewCreationInOpen }: Props = $props();
	const uiState = getContext(UiState);

	let canPublishReviewPlugin = $state<ReturnType<typeof CanPublishReviewPlugin>>();

	/**
	 * Determine which is the branch that should be reviwed.
	 *
	 * Iterate the branches in reverse order, and depending on whether the user is allowed to
	 * publish a pull request or a butler request, return the first branch that matches the criteria.
	 */
	function getBranchToReview(
		branches: BranchDetails[],
		allowedToPublishPR: boolean | undefined,
		allowedToPublishBR: boolean | undefined
	) {
		if (!allowedToPublishBR && !allowedToPublishPR) {
			// If the user is not allowed to publish any branch, return undefined.
			return undefined;
		}

		for (let i = branches.length - 1; i >= 0; i--) {
			const branch = branches[i]!;
			if (allowedToPublishBR && branch.reviewId === null) {
				// Can publish butler request and this branch doesn't
				// have a review id.
				return branch;
			}

			if (allowedToPublishPR && branch.prNumber === null) {
				// Can publish pull request and this branch has a review id.
				return branch;
			}
		}
		return undefined;
	}

	const branchToReview = $derived(
		getBranchToReview(
			branches,
			canPublishReviewPlugin?.imports.allowedToPublishPR,
			canPublishReviewPlugin?.imports.allowedToPublishBR
		)
	);

	const branchName = $derived(branchToReview?.name);
	const prNumber = $derived(branchToReview?.prNumber ?? undefined);
	const reviewId = $derived(branchToReview?.reviewId ?? undefined);

	const canPublishBR = $derived(!!canPublishReviewPlugin?.imports.canPublishBR);
	const canPublishPR = $derived(!!canPublishReviewPlugin?.imports.canPublishPR);
	const ctaLabel = $derived(canPublishReviewPlugin?.imports.ctaLabel);
	const branchEmpty = $derived(canPublishReviewPlugin?.imports.branchIsEmpty);

	const hasConflicts = $derived(branchToReview ? branchToReview.isConflicted : false);

	const canPublish = $derived(canPublishBR || canPublishPR);

	function publish() {
		if (!branchName) return;

		uiState.stack(stackId).selection.set({ branchName });
		uiState.stack(stackId).action.set('review');
		uiState.project(projectId).stackId.set(stackId);
	}

	const tooltip = $derived.by(() => {
		if (!branchName) {
			return 'No available branches';
		}

		if (hasConflicts) {
			return 'In order to push, please resolve any conflicted commits.';
		} else {
			return branches.length > 1 ? `Create for ${branchName}` : undefined;
		}
	});
</script>

<CanPublishReviewPlugin
	{projectId}
	{stackId}
	{branchName}
	{prNumber}
	{reviewId}
	bind:this={canPublishReviewPlugin}
/>

{#if canPublish && !branchEmpty}
	<div class="publish-button" style:flex>
		<Button
			testId={TestId.StackPublishButton}
			style="neutral"
			wide
			kind={reviewCreationInOpen ? 'outline' : 'solid'}
			disabled={!branchName || hasConflicts || reviewCreationInOpen}
			{tooltip}
			tooltipPosition="top"
			onclick={publish}
		>
			{ctaLabel}
		</Button>
	</div>
{/if}

<style>
	.publish-button {
		flex: 1;
		/* This is just here so that the disabled button is still opaque */
		border-radius: var(--radius-m);
		background-color: var(--clr-bg-1);
	}
</style>
