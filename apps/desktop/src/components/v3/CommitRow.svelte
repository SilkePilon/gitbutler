<script lang="ts">
	import CommitHeader from '$components/v3/CommitHeader.svelte';
	import CommitLine from '$components/v3/CommitLine.svelte';
	import { type CommitStatusType } from '$lib/commits/commit';
	import { TestId } from '$lib/testing/testIds';

	import Icon from '@gitbutler/ui/Icon.svelte';
	import { slide } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	type BaseProps = {
		type: CommitStatusType;
		branchName: string;
		commitId: string;
		commitMessage: string;
		createdAt: number;
		tooltip?: string;
		first?: boolean;
		lastCommit?: boolean;
		lastBranch?: boolean;
		selected?: boolean;
		opacity?: number;
		borderTop?: boolean;
		disableCommitActions?: boolean;
		isOpen?: boolean;
		active?: boolean;
		hasConflicts?: boolean;
		menu?: Snippet<[{ rightClickTrigger: HTMLElement }]>;
		onclick?: () => void;
	};

	type RemoteStatusProps = {
		type: 'LocalOnly' | 'Integrated' | 'Remote';
	};

	type LocalAndRemoteWithActions = {
		type: 'LocalAndRemote';
		disableCommitActions: false;
		diverged: boolean;
	};

	type LocalAndRemoteDisabled = {
		type: 'LocalAndRemote';
		disableCommitActions: true;
	};

	type WithStackId = {
		disableCommitActions: false;
		stackId: string;
	};

	type WithoutStackId = {
		disableCommitActions: true;
	};

	type Props = BaseProps &
		(RemoteStatusProps | LocalAndRemoteWithActions | LocalAndRemoteDisabled) &
		(WithStackId | WithoutStackId);

	const {
		commitMessage,
		tooltip,
		first,
		lastCommit,
		lastBranch,
		selected,
		opacity,
		borderTop,
		isOpen,
		active,
		onclick,
		menu,
		hasConflicts,
		...args
	}: Props = $props();

	let container = $state<HTMLDivElement>();
</script>

<div
	bind:this={container}
	role="button"
	tabindex="0"
	aria-label="Commit row"
	class="commit-row"
	class:menu-shown={isOpen}
	class:first
	class:selected
	style:opacity
	class:border-top={borderTop || first}
	class:last={lastCommit}
	onclick={(e) => {
		e.stopPropagation();
		onclick?.();
	}}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.stopPropagation();
			onclick?.();
		}
	}}
>
	{#if selected}
		<div
			class="commit-row__select-indicator"
			class:active
			in:slide={{ axis: 'x', duration: 150 }}
		></div>
	{/if}

	<CommitLine
		commitStatus={args.type}
		diverged={args.type === 'LocalAndRemote' && !args.disableCommitActions ? args.diverged : false}
		{tooltip}
		{lastCommit}
		{lastBranch}
	/>

	<div data-testid={TestId.CommitRow} class="commit-content" class:shift-to-left={hasConflicts}>
		{#if hasConflicts}
			<div class="commit-conflict-indicator">
				<Icon name="warning" size={12} />
			</div>
		{/if}

		<div class="commit-name truncate">
			<CommitHeader {commitMessage} truncate className="text-13 text-semibold" />
		</div>

		{#if !args.disableCommitActions}
			{@render menu?.({ rightClickTrigger: container })}
		{/if}
	</div>
</div>

<style lang="postcss">
	.commit-row {
		display: flex;
		position: relative;
		width: 100%;
		overflow: hidden;
		transition: background-color var(--transition-fast);

		&:hover,
		&.menu-shown {
			background-color: var(--clr-bg-1-muted);
		}

		&:not(.last) {
			border-bottom: 1px solid var(--clr-border-2);
		}

		&:focus-within,
		&.selected {
			background-color: var(--clr-selected-not-in-focus-bg);
		}

		&:focus-within.selected {
			background-color: var(--clr-selected-in-focus-bg);
		}
	}

	.commit-row__select-indicator {
		position: absolute;
		top: 50%;
		left: 0;
		width: 4px;
		height: 45%;
		transform: translateY(-50%);
		border-radius: 0 var(--radius-ml) var(--radius-ml) 0;
		background-color: var(--clr-selected-not-in-focus-element);
		transition: transform var(--transition-fast);
		&.active {
			background-color: var(--clr-selected-in-focus-element);
		}
	}

	.commit-content {
		display: flex;
		position: relative;
		align-items: center;
		width: 100%;
		padding-right: 9px;
		overflow: hidden;
		gap: 4px;
	}

	.commit-name {
		display: flex;
		flex: 1;
		padding: 14px 0 14px 0;
	}

	.commit-conflict-indicator {
		display: flex;
		margin-right: 4px;
		color: var(--clr-theme-err-element);
	}

	/* MODIFIERS */
	.shift-to-left {
		margin-left: -3px;
	}
</style>
