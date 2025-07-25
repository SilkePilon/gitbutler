<script lang="ts">
	import ConfigurableScrollableContainer from '$components/ConfigurableScrollableContainer.svelte';
	import ReduxResult from '$components/ReduxResult.svelte';
	import Resizer from '$components/Resizer.svelte';
	import StackStickyButtons from '$components/StackStickyButtons.svelte';
	import AsyncRender from '$components/v3/AsyncRender.svelte';
	import BranchList from '$components/v3/BranchList.svelte';
	import BranchView from '$components/v3/BranchView.svelte';
	import CommitView from '$components/v3/CommitView.svelte';
	import NewCommitView from '$components/v3/NewCommitView.svelte';
	import PushButton from '$components/v3/PushButton.svelte';
	import SelectionView from '$components/v3/SelectionView.svelte';
	import WorktreeChanges from '$components/v3/WorktreeChanges.svelte';
	import { onReorderEnd, onReorderMouseDown, onReorderStart } from '$lib/dragging/reordering';
	import { isParsedError } from '$lib/error/parser';
	import { DefinedFocusable } from '$lib/focus/focusManager.svelte';
	import { focusable } from '$lib/focus/focusable.svelte';
	import {
		IntelligentScrollingService,
		scrollingAttachment
	} from '$lib/intelligentScrolling/service';
	import { IdSelection } from '$lib/selection/idSelection.svelte';
	import { readKey } from '$lib/selection/key';
	import { UncommittedService } from '$lib/selection/uncommittedService.svelte';
	import { StackService } from '$lib/stacks/stackService.svelte';
	import { UiState } from '$lib/state/uiState.svelte';
	import { TestId } from '$lib/testing/testIds';
	import { inject } from '@gitbutler/shared/context';
	import { persistWithExpiration } from '@gitbutler/shared/persisted';
	import Button from '@gitbutler/ui/Button.svelte';
	import Icon from '@gitbutler/ui/Icon.svelte';
	import { intersectionObserver } from '@gitbutler/ui/utils/intersectionObserver';
	import type { Stack } from '$lib/stacks/stack';

	type Props = {
		projectId: string;
		stack: Stack;
		focusedStackId?: string;
		onVisible: (visible: boolean) => void;
		clientWidth?: number;
		clientHeight?: number;
	};

	let {
		projectId,
		stack,
		focusedStackId,
		clientHeight = $bindable(),
		clientWidth = $bindable(),
		onVisible
	}: Props = $props();

	let lanesSrollableEl = $state<HTMLDivElement>();

	const [uiState, uncommittedService, idSelection, stackService, intelligentScrollingService] =
		inject(UiState, UncommittedService, IdSelection, StackService, IntelligentScrollingService);
	const projectState = $derived(uiState.project(projectId));

	const action = $derived(projectState.exclusiveAction.current);
	const isCommitting = $derived(action?.type === 'commit' && action.stackId === stack.id);

	// If the user is making a commit to a different lane we dim this one.
	const dimmed = $derived(action?.type === 'commit' && action?.stackId !== stack.id);

	const persistedStackWidth = persistWithExpiration(
		uiState.global.stackWidth.current,
		`ui-stack-width-${stack.id}`,
		1440
	);

	const branchesResult = $derived(stackService.branches(projectId, stack.id));

	let dropzoneActivated = $state(false);

	const stackState = $derived(uiState.stack(stack.id));
	const selection = $derived(stackState.selection);
	const assignedSelection = $derived(
		idSelection.getById({
			type: 'worktree',
			stackId: stack.id
		})
	);
	const lastAddedAssigned = $derived(assignedSelection.lastAdded);
	const assignedKey = $derived(
		$lastAddedAssigned?.key ? readKey($lastAddedAssigned.key) : undefined
	);

	const commitId = $derived(selection.current?.commitId);
	const branchName = $derived(selection.current?.branchName);
	const upstream = $derived(selection.current?.upstream);

	const selectedLastAdded = $derived.by(() => {
		if (commitId) {
			return idSelection.getById({ type: 'commit', commitId }).lastAdded;
		} else if (branchName) {
			return idSelection.getById({ type: 'branch', stackId: stack.id, branchName }).lastAdded;
		}
	});
	const selectedKey = $derived(
		$selectedLastAdded?.key ? readKey($selectedLastAdded.key) : undefined
	);
	const changes = $derived(uncommittedService.changesByStackId(stack.id || null));

	let viewWrapperEl = $state<HTMLDivElement>();
	let stackViewEl = $state<HTMLDivElement>();
	let detailsEl = $state<HTMLDivElement>();
	let previewEl = $state<HTMLDivElement>();

	const defaultBranchResult = $derived(stackService.defaultBranch(projectId, stack.id));
	const defaultBranchName = $derived(defaultBranchResult?.current.data);

	function startCommit() {
		projectState.exclusiveAction.set({
			type: 'commit',
			branchName: defaultBranchName,
			stackId: stack.id
		});
		const stackAssignments = uncommittedService.getAssignmentsByStackId(stack.id);
		if (stackAssignments.length > 0) {
			uncommittedService.checkAll(stack.id);
			uncommittedService.uncheckAll(null);
		} else {
			uncommittedService.checkAll(null);
		}
	}

	function onclose() {
		selection.set(undefined);
		intelligentScrollingService.show(projectId, stack.id, 'stack');
	}

	// Clear selection if branch cannot be found.
	// TODO: How can we express this better?
	$effect(() => {
		if (selection.current && branchesResult.current.data) {
			setTimeout(() => {
				if (selection.current && branchesResult.current.data) {
					const { branchName } = selection.current;
					if (!branchesResult.current.data.some((b) => b.name === branchName)) {
						selection.set(undefined);
					}
				}
			}, 500);
		}
	});

	// Clear selection if commit cannot be found.
	// TODO: How can we express this better?
	$effect(() => {
		if (selection.current) {
			setTimeout(() => {
				if (selection.current) {
					const { branchName, commitId } = selection.current;
					if (branchName && commitId) {
						stackService.fetchCommitById(projectId, stack.id, commitId).then((result) => {
							if (!result.data) {
								selection.set(undefined);
							}
						});
					}
				}
			}, 500);
		}
	});

	const startCommitVisible = $derived(uncommittedService.startCommitVisible(stack.id));
	// const isCommittingAndFloating = $derived(
	// 	isCommitting && isCommitFloating && startCommitVisible.current
	// );
</script>

<AsyncRender>
	<!-- eslint-disable-next-line func-style -->
	{@const onerror = (err: unknown) => {
		// Clear selection if branch not found.
		if (isParsedError(err) && err.code === 'errors.branch.notfound') {
			selection?.set(undefined);
			console.warn('Workspace selection cleared');
		}
	}}
	<div
		bind:this={viewWrapperEl}
		class="stack-view-wrapper"
		role="presentation"
		class:dimmed
		tabindex="-1"
		draggable="true"
		data-id={stack.id}
		data-testid={TestId.Stack}
		data-testid-stackid={stack.id}
		data-testid-stack={stack.heads.at(0)?.name}
		onmousedown={(e) => onReorderMouseDown(e, viewWrapperEl?.parentElement as HTMLDivElement)}
		ondragstart={(e) => onReorderStart(e, stack.id, onclose)}
		ondragend={onReorderEnd}
		use:intersectionObserver={{
			callback: (entry) => {
				onVisible(!!entry?.isIntersecting);
			},
			options: {
				threshold: 0.5,
				root: lanesSrollableEl
			}
		}}
		use:focusable={{
			id: DefinedFocusable.Stack + ':' + stack.id,
			parentId: DefinedFocusable.ViewportRight
		}}
	>
		<div
			class="stack-view"
			style:width={$persistedStackWidth + 'rem'}
			bind:clientWidth
			bind:clientHeight
			bind:this={stackViewEl}
			{@attach scrollingAttachment(intelligentScrollingService, projectId, stack.id, 'stack')}
		>
			{#if !isCommitting}
				<div class="drag-handle" data-remove-from-panning data-drag-handle>
					<Icon name="draggable-narrow" rotate={90} />
				</div>
			{/if}
			<Resizer
				persistId="resizer-panel1-${stack.id}"
				viewport={stackViewEl!}
				zIndex="var(--z-lifted)"
				direction="right"
				minWidth={16}
				maxWidth={64}
				syncName="panel1"
				dblclickSize
				imitateBorder
			/>
			<ReduxResult {projectId} result={branchesResult.current}>
				{#snippet children(branches)}
					<ConfigurableScrollableContainer>
						<!-- If we are currently committing, we should keep this open so users can actually stop committing again :wink: -->
						{#if startCommitVisible.current || isCommitting}
							<div
								class="assignments-wrap"
								class:assignments__empty={changes.current.length === 0 && !isCommitting}
							>
								<div
									class="worktree-wrap"
									class:remove-border-bottom={isCommitting && changes.current.length === 0}
									class:dropzone-activated={dropzoneActivated && changes.current.length === 0}
								>
									<WorktreeChanges
										title="Assigned"
										{projectId}
										stackId={stack.id}
										mode="assigned"
										active={focusedStackId === stack.id}
										dropzoneVisible={changes.current.length === 0 && !isCommitting}
										onDropzoneActivated={(activated) => {
											dropzoneActivated = activated;
										}}
										onselect={() => {
											// Clear one selection when you modify the other.
											stackState?.selection.set(undefined);
											intelligentScrollingService.show(projectId, stack.id, 'diff');
										}}
									>
										{#snippet emptyPlaceholder()}
											{#if !isCommitting}
												<div class="assigned-changes-empty">
													<p class="text-12 text-body assigned-changes-empty__text">
														Drop files to assign to the lane
													</p>
												</div>
											{/if}
										{/snippet}
									</WorktreeChanges>
								</div>

								{#if !isCommitting}
									<div class="start-commit">
										<Button
											testId={TestId.StartCommitButton}
											type="button"
											wide
											disabled={defaultBranchResult?.current.isLoading}
											onclick={() => {
												startCommit();
											}}
										>
											Start a commit…
										</Button>
									</div>
								{:else if isCommitting}
									<NewCommitView {projectId} stackId={stack.id} />
								{/if}
							</div>
						{/if}

						<BranchList
							{projectId}
							{branches}
							stackId={stack.id}
							{focusedStackId}
							onselect={() => {
								// Clear one selection when you modify the other.
								idSelection.clear({ type: 'worktree', stackId: stack.id });
								intelligentScrollingService.show(projectId, stack.id, 'details');
							}}
						/>
					</ConfigurableScrollableContainer>
					<StackStickyButtons>
						<PushButton
							flex="1"
							{projectId}
							stackId={stack.id}
							multipleBranches={branches.length > 1}
						/>
					</StackStickyButtons>
				{/snippet}
			</ReduxResult>
		</div>

		{#if assignedKey || branchName || commitId}
			<div
				bind:this={detailsEl}
				style:width={uiState.global.detailsWidth.current + 'rem'}
				class="details"
				data-remove-from-draggable
				data-details={stack.id}
			>
				{#if assignedKey && assignedKey.type === 'worktree'}
					<div
						{@attach scrollingAttachment(intelligentScrollingService, projectId, stack.id, 'diff')}
					>
						<SelectionView
							{projectId}
							selectionId={{ ...assignedKey, type: 'worktree', stackId: assignedKey.stackId }}
							onclose={() => {
								intelligentScrollingService.show(projectId, stack.id, 'stack');
							}}
						/>
					</div>
				{:else if branchName && commitId}
					<div
						{@attach scrollingAttachment(
							intelligentScrollingService,
							projectId,
							stack.id,
							'details'
						)}
					>
						<CommitView
							{projectId}
							stackId={stack.id}
							commitKey={{
								stackId: stack.id,
								branchName,
								commitId,
								upstream: !!upstream
							}}
							active={selectedKey?.type === 'commit' && focusedStackId === stack.id}
							{onerror}
							{onclose}
						/>
					</div>
				{:else if branchName}
					<div
						{@attach scrollingAttachment(
							intelligentScrollingService,
							projectId,
							stack.id,
							'details'
						)}
					>
						<BranchView
							stackId={stack.id}
							{projectId}
							{branchName}
							active={selectedKey?.type === 'branch' &&
								selectedKey.branchName === branchName &&
								focusedStackId === stack.id}
							draggableFiles
							{onerror}
							{onclose}
						/>
					</div>
				{/if}
				<Resizer
					viewport={detailsEl}
					persistId="resizer-panel2-${stack.id}"
					direction="right"
					minWidth={16}
					maxWidth={56}
					syncName="panel2"
					dblclickSize
				/>
			</div>
		{/if}

		{#if selectedKey && !assignedKey}
			<div
				bind:this={previewEl}
				style:width={uiState.global.previewWidth.current + 'rem'}
				class="preview"
				data-remove-from-draggable
				use:focusable={{
					id: DefinedFocusable.Preview + ':' + stack.id,
					parentId: DefinedFocusable.ViewportRight
				}}
				{@attach scrollingAttachment(intelligentScrollingService, projectId, stack.id, 'diff')}
			>
				<SelectionView
					{projectId}
					selectionId={selectedKey}
					onclose={() => {
						intelligentScrollingService.show(projectId, stack.id, 'details');
					}}
				/>
				<Resizer
					viewport={previewEl}
					persistId="resizer-panel2-${stack.id}"
					direction="right"
					minWidth={20}
					maxWidth={96}
					syncName="panel2"
					dblclickSize
				/>
			</div>
		{/if}
	</div>
</AsyncRender>

<style lang="postcss">
	.stack-view-wrapper {
		display: flex;
		position: relative;
		flex-shrink: 0;
		overflow: hidden;
		transition: opacity 0.15s;

		&.dimmed {
			opacity: 0.5;
		}
		&:first-child {
			border-left: 1px solid var(--clr-border-2);
		}
	}

	.stack-view {
		display: flex;
		position: relative;
		flex-shrink: 0;
		flex-direction: column;
	}

	.dimmed .stack-view {
		pointer-events: none;
	}

	.assigned-changes-empty__text {
		width: 100%;
		color: var(--clr-text-2);
		text-align: center;
		opacity: 0.7;
		transition:
			color var(--transition-fast),
			opacity var(--transition-fast);
	}

	.assignments-wrap {
		display: flex;
		flex-shrink: 0;
		flex-direction: column;
		margin: 12px;
		margin-bottom: 0;
		overflow: hidden;
		border: 1px solid var(--clr-border-2);
		border-radius: var(--radius-ml);
	}

	.worktree-wrap {
		display: flex;
		flex-direction: column;
		border-bottom: 1px solid var(--clr-border-2);
		border-radius: var(--radius-ml) var(--radius-ml) 0 0;

		&.remove-border-bottom {
			border-bottom: none;
		}

		&.dropzone-activated {
			& .assigned-changes-empty {
				padding: 20px 8px 20px;
				background-color: var(--clr-bg-1);
				will-change: padding;
			}

			& .assigned-changes-empty__text {
				color: var(--clr-theme-pop-on-soft);
			}
		}
	}

	.details,
	.preview {
		position: relative;
		flex-shrink: 0;
		border-right: 1px solid var(--clr-border-2);
		white-space: wrap;
	}

	.start-commit {
		padding: 12px;
		/* border-top: 1px solid var(--clr-border-2); */
		background-color: var(--clr-bg-1);
	}

	/* EMPTY ASSIGN AREA */
	.assigned-changes-empty {
		display: flex;
		position: relative;
		padding: 10px 8px;
		overflow: hidden;
		gap: 12px;
		background-color: var(--clr-bg-2);
		transition: background-color var(--transition-fast);
	}

	.drag-handle {
		display: flex;
		z-index: var(--z-floating);
		position: absolute;
		justify-content: flex-end;
		width: 100%;
		padding: 0 1px;
		color: var(--clr-text-2);
		cursor: grab;
		transition: color var(--transition-fast);

		&:hover {
			color: var(--clr-text-1);
		}
	}
</style>
