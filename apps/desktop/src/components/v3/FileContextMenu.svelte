<!-- This is a V3 replacement for `FileContextMenu.svelte` -->
<script lang="ts">
	import { ActionService } from '$lib/actions/actionService.svelte';
	import { AIService } from '$lib/ai/service';
	import { writeClipboard } from '$lib/backend/clipboard';
	import { changesToDiffSpec } from '$lib/commits/utils';
	import { projectAiGenEnabled } from '$lib/config/config';
	import { isTreeChange, type TreeChange } from '$lib/hunks/change';
	import { Project } from '$lib/project/project';
	import { IdSelection } from '$lib/selection/idSelection.svelte';
	import { SETTINGS, type Settings } from '$lib/settings/userSettings';
	import { StackService } from '$lib/stacks/stackService.svelte';
	import { UiState } from '$lib/state/uiState.svelte';
	import { computeChangeStatus } from '$lib/utils/fileStatus';
	import { getEditorUri, openExternalUrl } from '$lib/utils/url';
	import { getContextStoreBySymbol, inject } from '@gitbutler/shared/context';
	import AsyncButton from '@gitbutler/ui/AsyncButton.svelte';
	import Button from '@gitbutler/ui/Button.svelte';
	import ContextMenu from '@gitbutler/ui/ContextMenu.svelte';
	import ContextMenuItem from '@gitbutler/ui/ContextMenuItem.svelte';
	import ContextMenuSection from '@gitbutler/ui/ContextMenuSection.svelte';
	import Modal from '@gitbutler/ui/Modal.svelte';
	import Textbox from '@gitbutler/ui/Textbox.svelte';
	import FileListItem from '@gitbutler/ui/file/FileListItemV3.svelte';
	import * as toasts from '@gitbutler/ui/toasts';
	import { join } from '@tauri-apps/api/path';
	import type { DiffSpec } from '$lib/hunks/hunk';
	import type { SelectionId } from '$lib/selection/key';
	import type { Writable } from 'svelte/store';

	type Props = {
		projectId: string;
		stackId: string | undefined;
		selectionId: SelectionId;
		trigger?: HTMLElement;
	};

	type FileItem = {
		changes: TreeChange[];
	};

	function isFileItem(item: unknown): item is FileItem {
		return (
			typeof item === 'object' &&
			item !== null &&
			'changes' in item &&
			Array.isArray(item.changes) &&
			item.changes.every(isTreeChange)
		);
	}

	const { trigger, selectionId, stackId, projectId }: Props = $props();
	const [stackService, project, uiState, idSelection, aiService, actionService] = inject(
		StackService,
		Project,
		UiState,
		IdSelection,
		AIService,
		ActionService
	);
	const [autoCommit, autoCommitting] = actionService.autoCommit;

	const userSettings = getContextStoreBySymbol<Settings, Writable<Settings>>(SETTINGS);
	const isUncommitted = $derived(selectionId.type === 'worktree');

	let confirmationModal: ReturnType<typeof Modal> | undefined;
	let stashConfirmationModal: ReturnType<typeof Modal> | undefined;
	let contextMenu: ReturnType<typeof ContextMenu>;
	let aiConfigurationValid = $state(false);

	const aiGenEnabled = $derived(projectAiGenEnabled(projectId));

	const canUseGBAI = $derived(aiGenEnabled && aiConfigurationValid);

	function isDeleted(item: FileItem): boolean {
		return item.changes.some((change) => {
			return change.status.type === 'Deletion';
		});
	}

	async function confirmDiscard(item: FileItem) {
		const worktreeChanges: DiffSpec[] = item.changes.map((change) => ({
			previousPathBytes:
				change.status.type === 'Rename' ? change.status.subject.previousPathBytes : null,
			pathBytes: change.pathBytes,
			hunkHeaders: []
		}));

		await stackService.discardChanges({
			projectId,
			worktreeChanges
		});

		confirmationModal?.close();
	}

	let stashBranchName = $state<string>();
	async function confirmStashIntoBranch(item: FileItem, branchName: string | undefined) {
		if (!branchName) {
			return;
		}
		const worktreeChanges: DiffSpec[] = item.changes.map((change) => ({
			previousPathBytes:
				change.status.type === 'Rename' ? change.status.subject.previousPathBytes : null,
			pathBytes: change.pathBytes,
			hunkHeaders: []
		}));

		await stackService.stashIntoBranch({
			projectId,
			branchName,
			worktreeChanges
		});

		stashConfirmationModal?.close();
	}

	export function open(e: MouseEvent, item: FileItem) {
		contextMenu.open(e, item);
		aiService.validateGitButlerAPIConfiguration().then((value) => {
			aiConfigurationValid = value;
		});
	}

	async function uncommitChanges(stackId: string, commitId: string, changes: TreeChange[]) {
		const { replacedCommits } = await stackService.uncommitChanges({
			projectId,
			stackId,
			commitId,
			changes: changesToDiffSpec(changes)
		});
		const newCommitId = replacedCommits.find(([before]) => before === commitId)?.[1];
		const branchName = uiState.stack(stackId).selection.current?.branchName;
		const selectedFiles = changes.map((change) => ({ ...selectionId, path: change.path }));

		// Unselect the uncommitted files
		idSelection.removeMany(selectedFiles);

		if (newCommitId && branchName) {
			// Update the selection to the new commit
			uiState.stack(stackId).selection.set({ branchName, commitId: newCommitId });
		}
		contextMenu.close();
	}
</script>

<ContextMenu
	bind:this={contextMenu}
	rightClickTrigger={trigger}
	onclose={() => {
		aiConfigurationValid = false;
	}}
>
	{#snippet children(item: unknown)}
		{#if isFileItem(item)}
			{@const deletion = isDeleted(item)}
			<ContextMenuSection>
				{#if item.changes.length > 0}
					{@const changes = item.changes}
					{#if isUncommitted}
						<ContextMenuItem
							label="Discard changes"
							onclick={() => {
								confirmationModal?.show(item);
								contextMenu.close();
							}}
						/>
					{/if}
					{#if isUncommitted}
						<ContextMenuItem
							label="Stash into branch"
							onclick={() => {
								stackService.newBranchName(projectId).then((name) => {
									stashBranchName = name.data || '';
								});
								stashConfirmationModal?.show(item);
								contextMenu.close();
							}}
						/>
					{/if}
					{#if canUseGBAI}
						<ContextMenuItem
							label="Auto commit"
							onclick={async () => {
								await autoCommit({
									projectId,
									changes: item.changes
								});
								contextMenu.close();
							}}
							disabled={autoCommitting.current.isLoading}
						/>
					{/if}
					{#if selectionId.type === 'commit' && stackId}
						{@const commitId = selectionId.commitId}
						<ContextMenuItem
							label="Uncommit changes"
							onclick={async () => uncommitChanges(stackId, commitId, changes)}
						/>
					{/if}
					{#if changes.length === 1}
						<ContextMenuItem
							label="Copy Path"
							onclick={async () => {
								if (!project) return;
								const absPath = await join(project.path, changes[0]!.path);
								await writeClipboard(absPath, {
									errorMessage: 'Failed to copy absolute path'
								});
								contextMenu.close();
								// dismiss();
							}}
						/>
						<ContextMenuItem
							label="Copy Relative Path"
							onclick={async () => {
								if (!project) return;
								await writeClipboard(changes[0]!.path, {
									errorMessage: 'Failed to copy relative path'
								});
								contextMenu.close();
							}}
						/>
					{/if}
					<ContextMenuItem
						label="Open in {$userSettings.defaultCodeEditor.displayName}"
						disabled={deletion}
						onclick={async () => {
							try {
								if (!project) return;
								for (let change of changes) {
									const path = getEditorUri({
										schemeId: $userSettings.defaultCodeEditor.schemeIdentifer,
										path: [project.vscodePath, change.path]
									});
									openExternalUrl(path);
								}
								contextMenu.close();
							} catch {
								console.error('Failed to open in editor');
								toasts.error('Failed to open in editor');
							}
						}}
					/>
				{/if}
			</ContextMenuSection>
		{:else}
			<ContextMenuSection>
				<p class="text-13">'Woops! Malformed data :(</p>
			</ContextMenuSection>
		{/if}
	{/snippet}
</ContextMenu>

<Modal
	width="small"
	type="warning"
	title="Discard changes"
	bind:this={confirmationModal}
	onSubmit={(_, item) => isFileItem(item) && confirmDiscard(item)}
>
	{#snippet children(item)}
		{#if isFileItem(item)}
			{@const changes = item.changes}
			{#if changes.length < 10}
				<p class="discard-caption">
					Are you sure you want to discard the changes<br />to the following files:
				</p>
				<ul class="file-list">
					{#each changes as change, i}
						<FileListItem
							filePath={change.path}
							fileStatus={computeChangeStatus(change)}
							clickable={false}
							listMode="list"
							isLast={i === changes.length - 1}
						/>
					{/each}
				</ul>
			{:else}
				<p>
					Discard the changes to all <span class="text-bold">
						{changes.length} files
					</span>?
				</p>
			{/if}
		{:else}
			<p class="text-13">Woops! Malformed data :(</p>
		{/if}
	{/snippet}
	{#snippet controls(close, item)}
		<Button kind="outline" onclick={close}>Cancel</Button>
		<AsyncButton style="error" type="submit" action={async () => await confirmDiscard(item)}>
			Confirm
		</AsyncButton>
	{/snippet}
</Modal>

<Modal
	width={500}
	type="info"
	bind:this={stashConfirmationModal}
	onSubmit={(_, item) => isFileItem(item) && confirmStashIntoBranch(item, stashBranchName)}
>
	<div class="content-wrap">
		<Textbox
			label="New branch to stash into"
			id="stashBranchName"
			bind:value={stashBranchName}
			autofocus
		/>

		<span>
			The selected changes will be stashed into branch <span class="text-bold"
				>{stashBranchName}</span
			> and removed from the workspace.
		</span>
		<span>
			You can re-apply them by re-applying the branch and "uncommitting" the stash commit.
		</span>

		<span class="text-12 text-body radio-aditional-info"
			>└ This operation is a "macro" for creating a branch, committing changes and then unapplying
			it. In the future, discovery and unstashing will be streamlined.</span
		>
	</div>

	{#snippet controls(close, item)}
		<Button kind="outline" type="reset" onclick={close}>Cancel</Button>
		<AsyncButton
			style="pop"
			disabled={!stashBranchName}
			type="submit"
			action={async () => await confirmStashIntoBranch(item, stashBranchName)}
		>
			Confirm
		</AsyncButton>
	{/snippet}
</Modal>

<style lang="postcss">
	.discard-caption {
		color: var(--clr-text-2);
	}
	.file-list {
		display: flex;
		flex-direction: column;
		margin-top: 12px;
		overflow: hidden;
		border: 1px solid var(--clr-border-2);
		border-radius: var(--radius-m);
		background-color: var(--clr-bg-1);
	}
	.radio-aditional-info {
		color: var(--clr-text-2);
	}
	/* MODAL WINDOW */
	.content-wrap {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
</style>
