<script lang="ts">
	import MessageEditorRuler from '$components/v3/editor/MessageEditorRuler.svelte';
	import CommitSuggestions from '$components/v3/editor/commitSuggestions.svelte';
	import { showError } from '$lib/notifications/toasts';
	import { SETTINGS, type Settings } from '$lib/settings/userSettings';
	import { UiState } from '$lib/state/uiState.svelte';
	import { getContext, getContextStoreBySymbol } from '@gitbutler/shared/context';
	import { uploadFiles } from '@gitbutler/shared/dom';
	import { persisted } from '@gitbutler/shared/persisted';
	import { UploadsService } from '@gitbutler/shared/uploads/uploadsService';
	import Button from '@gitbutler/ui/Button.svelte';
	import Checkbox from '@gitbutler/ui/Checkbox.svelte';
	import EmojiPickerButton from '@gitbutler/ui/EmojiPickerButton.svelte';
	import Modal from '@gitbutler/ui/Modal.svelte';
	import RichTextEditor from '@gitbutler/ui/RichTextEditor.svelte';
	import FileUploadPlugin, {
		type DropFileResult
	} from '@gitbutler/ui/richText/plugins/FileUpload.svelte';
	import Formatter from '@gitbutler/ui/richText/plugins/Formatter.svelte';
	import GhostTextPlugin from '@gitbutler/ui/richText/plugins/GhostText.svelte';
	import HardWrapPlugin from '@gitbutler/ui/richText/plugins/HardWrapPlugin.svelte';
	import FormattingBar from '@gitbutler/ui/richText/tools/FormattingBar.svelte';
	import FormattingButton from '@gitbutler/ui/richText/tools/FormattingButton.svelte';
	import Segment from '@gitbutler/ui/segmentControl/Segment.svelte';
	import SegmentControl from '@gitbutler/ui/segmentControl/SegmentControl.svelte';

	import { tick } from 'svelte';

	const ACCEPTED_FILE_TYPES = ['image/*', 'application/*', 'text/*', 'audio/*', 'video/*'];

	interface Props {
		isPrCreation?: boolean;
		projectId: string;
		disabled?: boolean;
		initialValue?: string;
		placeholder: string;
		onChange?: (text: string) => void;
		onKeyDown?: (e: KeyboardEvent) => boolean;
		enableFileUpload?: boolean;
		enableSmiles?: boolean;
		enableRuler?: boolean;
		onAiButtonClick: (e: MouseEvent) => void;
		canUseAI: boolean;
		aiIsLoading: boolean;
		suggestionsHandler?: CommitSuggestions;
		testId?: string;
	}

	let {
		isPrCreation,
		initialValue,
		placeholder,
		disabled,
		enableFileUpload,
		enableSmiles,
		onChange,
		onKeyDown,
		onAiButtonClick,
		enableRuler,
		canUseAI,
		aiIsLoading,
		suggestionsHandler,
		testId
	}: Props = $props();

	const MIN_RULER_VALUE = 30;
	const MAX_RULER_VALUE = 200;

	const uiState = getContext(UiState);

	const uploadsService = getContext(UploadsService);
	const userSettings = getContextStoreBySymbol<Settings>(SETTINGS);

	const useFloatingBox = $derived(
		isPrCreation ? uiState.global.useFloatingPrBox : uiState.global.useFloatingCommitBox
	);

	const useRuler = uiState.global.useRuler;
	const rulerCountValue = uiState.global.rulerCountValue;
	const wrapTextByRuler = uiState.global.wrapTextByRuler;

	let useRichText = $state<boolean>(false);

	const wrapCountValue = $derived(
		useRuler.current && !useRichText ? rulerCountValue.current : undefined
	);

	let composer = $state<ReturnType<typeof RichTextEditor>>();
	let formatter = $state<ReturnType<typeof Formatter>>();
	let fileUploadPlugin = $state<ReturnType<typeof FileUploadPlugin>>();
	let uploadConfirmationModal = $state<ReturnType<typeof Modal>>();
	const doNotShowUploadWarning = persisted<boolean>(false, 'doNotShowUploadWarning');
	let allowUploadOnce = $state<boolean>(false);
	let uploadedBy = $state<'drop' | 'attach' | undefined>(undefined);
	let tempDropFiles: FileList | undefined = $state(undefined);

	export async function getPlaintext(): Promise<string | undefined> {
		return composer?.getPlaintext();
	}

	async function handleChange(
		text: string,
		textUpToAnchor: string | undefined,
		textAfterAnchor: string | undefined
	) {
		onChange?.(text);
		await suggestionsHandler?.onChange(textUpToAnchor, textAfterAnchor);
	}

	function handleKeyDown(event: KeyboardEvent | null) {
		if (event && !event.metaKey && !event.ctrlKey) {
			// Prevent regular keystrokes from propagating so that we don't
			// trigger keyboard shortcuts while the user is typing a message.
			event.stopPropagation();
		}
		if (event && onKeyDown?.(event)) {
			return true;
		}
		return suggestionsHandler?.onKeyDown(event) ?? false;
	}

	function onEmojiSelect(emoji: string) {
		composer?.insertText(emoji);
	}

	function isAcceptedFileType(file: File): boolean {
		const type = file.type.split('/')[0];
		if (!type) return false;
		return ACCEPTED_FILE_TYPES.some((acceptedType) => acceptedType.startsWith(type));
	}

	async function onDropFiles(files: FileList | undefined): Promise<DropFileResult[]> {
		if (files === undefined) return [];
		const uploads = Array.from(files)
			.filter(isAcceptedFileType)
			.map(async (file) => {
				const upload = await uploadsService.uploadFile(file);

				return { name: file.name, url: upload.url, isImage: upload.isImage };
			});
		const settled = await Promise.allSettled(uploads);
		const successful = settled.filter((result) => result.status === 'fulfilled');
		const failed = settled.filter((result) => result.status === 'rejected');

		if (failed.length > 0) {
			console.error('File upload failed', failed);
			showError('File upload failed', failed.map((result) => result.reason).join(', '));
		}

		allowUploadOnce = false;

		return successful.map((result) => result.value);
	}

	async function handleDropFiles(
		files: FileList | undefined
	): Promise<DropFileResult[] | undefined> {
		if ($doNotShowUploadWarning || allowUploadOnce) {
			return onDropFiles(files);
		}

		uploadedBy = 'drop';
		tempDropFiles = files;
		uploadConfirmationModal?.show();
		return undefined;
	}

	async function attachFiles() {
		composer?.focus();

		const files = await uploadFiles(ACCEPTED_FILE_TYPES.join(','));

		if (!files) return;
		await fileUploadPlugin?.handleFileUpload(files);
	}

	function handleAttachFiles() {
		if ($doNotShowUploadWarning) {
			attachFiles();
			return;
		}
		uploadedBy = 'attach';
		uploadConfirmationModal?.show();
	}

	export function focus() {
		composer?.focus();
	}

	export function setText(text: string) {
		composer?.setText(text);
	}

	function stopPropagation(e: MouseEvent) {
		e.stopPropagation();
		e.preventDefault();
	}

	$effect(() => {
		if (useFloatingBox.current) {
			useRichText = false;
		}
	});
</script>

<Modal
	type="warning"
	title="Off to the cloud it goes!"
	width="small"
	bind:this={uploadConfirmationModal}
	onSubmit={async (close) => {
		allowUploadOnce = true;

		if (uploadedBy === 'drop') {
			const files = tempDropFiles;
			tempDropFiles = undefined;
			if (files) {
				composer?.focus();
				await fileUploadPlugin?.handleFileUpload(files);
			}
		} else if (uploadedBy === 'attach') {
			await attachFiles();
		}

		uploadedBy = undefined;
		close();
	}}
>
	Your file will be stored in GitButler’s digital vault, safe and sound. We promise it’s secure, so
	feel free to share the link however you like 🔐
	{#snippet controls(close)}
		<div class="modal-footer">
			<label for="dont-show-again" class="modal-footer__checkbox">
				<Checkbox name="dont-show-again" small bind:checked={$doNotShowUploadWarning} />
				<span class="text-12"> Don’t show this again</span>
			</label>
			<Button kind="outline" onclick={close}>Cancel</Button>
			<Button style="pop" type="submit">Yes, upload!</Button>
		</div>
	{/snippet}
</Modal>

<div
	role="presentation"
	class="editor-wrapper hide-native-scrollbar"
	style:--lexical-input-client-text-wrap={useRuler.current && !useRichText ? 'nowrap' : 'normal'}
	style:--extratoolbar-height={useFloatingBox.current ? '2.625rem' : '0'}
	style:--code-block-font={$userSettings.diffFont}
	style:--code-block-tab-size={$userSettings.tabSize}
	style:--code-block-ligatures={$userSettings.diffLigatures ? 'common-ligatures' : 'normal'}
	onclick={stopPropagation}
	ondblclick={stopPropagation}
>
	<div role="presentation" class="message-textarea">
		<div
			data-testid={testId}
			role="presentation"
			class="message-textarea__inner"
			onclick={() => {
				composer?.focus();
			}}
		>
			{#if useRuler.current && !useRichText && enableRuler}
				<MessageEditorRuler />
			{/if}

			{#if useFloatingBox.current}
				<div class="editor-extratools">
					<FormattingBar {formatter} />

					<SegmentControl
						size="small"
						defaultIndex={!useRichText ? 0 : 1}
						onselect={() => {
							useRichText = !useRichText;
						}}
					>
						<Segment id="plain-text">Plain text</Segment>
						<Segment id="rich-text">Rich editor</Segment>
					</SegmentControl>
				</div>
			{/if}

			<div class="message-textarea__wrapper">
				<RichTextEditor
					minHeight="4rem"
					styleContext="client-editor"
					namespace="CommitMessageEditor"
					{placeholder}
					bind:this={composer}
					markdown={useRichText}
					onError={(e) => console.warn('Editor error', e)}
					initialText={initialValue}
					onChange={handleChange}
					onKeyDown={handleKeyDown}
					{disabled}
					wrapCountValue={useRichText ? undefined : wrapCountValue}
				>
					{#snippet plugins()}
						<Formatter bind:this={formatter} />
						<FileUploadPlugin bind:this={fileUploadPlugin} onDrop={handleDropFiles} />
						{#if suggestionsHandler}
							<GhostTextPlugin
								bind:this={suggestionsHandler.ghostTextComponent}
								onSelection={(text) => suggestionsHandler.onAcceptSuggestion(text)}
							/>
						{/if}
						{#if !useRichText}
							<HardWrapPlugin
								enabled={!useRichText && wrapTextByRuler.current}
								maxLength={wrapCountValue}
							/>
						{/if}
					{/snippet}
				</RichTextEditor>
			</div>
		</div>

		<div class="message-textarea__toolbar">
			<div class="message-textarea__toolbar__left">
				<Button
					kind="ghost"
					icon={useFloatingBox.current ? 'exit-floating-box' : 'enter-floating-box'}
					tooltip={useFloatingBox.current ? 'Exit floating mode' : 'Use floating mode'}
					onclick={() => {
						useFloatingBox.current = !useFloatingBox.current;
					}}
				/>
				<div class="message-textarea__toolbar__divider"></div>
				{#if enableSmiles}
					<EmojiPickerButton onEmojiSelect={(emoji) => onEmojiSelect(emoji.unicode)} />
				{/if}
				{#if enableFileUpload}
					<Button
						kind="ghost"
						icon="attachment-small"
						tooltip="Drop, paste or click to upload files"
						onclick={handleAttachFiles}
					/>
				{/if}
				{#if !useRichText && enableRuler}
					<div class="flex gap-2">
						<FormattingButton
							icon="ruler"
							activated={useRuler.current}
							tooltip="Text ruler"
							onclick={() => {
								useRuler.current = !useRuler.current;
							}}
						/>
						{#if useRuler.current}
							<div class="message-textarea__ruler-input-wrapper" class:disabled={!useRuler.current}>
								<input
									disabled={!useRuler.current}
									value={rulerCountValue.current}
									min={MIN_RULER_VALUE}
									max={MAX_RULER_VALUE}
									class="text-13 text-input message-textarea__ruler-input"
									type="number"
									onblur={() => {
										if (rulerCountValue.current < MIN_RULER_VALUE) {
											console.warn('Ruler value must be greater than 10');
											rulerCountValue.current = MIN_RULER_VALUE;
										} else if (rulerCountValue.current > MAX_RULER_VALUE) {
											rulerCountValue.current = MAX_RULER_VALUE;
										}
									}}
									oninput={(e) => {
										const input = e.currentTarget as HTMLInputElement;
										rulerCountValue.current = parseInt(input.value);
									}}
									onkeydown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											composer?.focus();
										}
									}}
								/>
							</div>
						{/if}
					</div>
					<FormattingButton
						icon="text-wrap"
						disabled={!useRuler.current}
						activated={wrapTextByRuler.current && useRuler.current}
						tooltip="Wrap text automatically"
						onclick={async () => {
							wrapTextByRuler.current = !wrapTextByRuler.current;
							await tick(); // Wait for reactive update.
							if (wrapTextByRuler.current) {
								composer?.wrapAll();
							}
						}}
					/>
				{/if}
			</div>
			<Button
				kind="outline"
				icon="ai"
				tooltip={!canUseAI
					? 'You need to enable AI in the project settings to use this feature'
					: undefined}
				disabled={!canUseAI}
				onclick={onAiButtonClick}
				reversedDirection
				shrinkable
				loading={aiIsLoading}>Generate message</Button
			>
		</div>
	</div>
</div>

<style lang="postcss">
	.editor-wrapper {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		overflow: auto;
	}

	.editor-extratools {
		display: flex;
		align-items: center;
		height: var(--extratoolbar-height);
		padding: 0 10px;
		gap: 12px;
		border-bottom: 1px solid var(--clr-border-3);
		background-color: var(--clr-bg-2);
	}

	/* MESSAGE INPUT */
	.message-textarea {
		display: flex;
		position: relative;
		flex: 1;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--clr-border-2);
		border-radius: 0 0 var(--radius-m) var(--radius-m);
		background-color: var(--clr-bg-1);
		transition: border-color var(--transition-fast);

		&:hover,
		&:focus-within {
			border-color: var(--clr-border-1);
		}
	}

	.message-textarea__toolbar {
		container-type: inline-size;
		display: flex;
		position: relative;
		flex: 0 0 auto;
		align-items: center;
		justify-content: flex-start;
		height: var(--lexical-input-client-toolbar-height);
		padding: 0 12px;
		gap: 6px;

		&:after {
			position: absolute;
			top: 0;
			left: 12px;
			width: calc(100% - 24px);
			height: 1px;
			background-color: var(--clr-border-3);
			content: '';
		}
	}

	.message-textarea__toolbar__left {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 6px;
	}

	.message-textarea__toolbar__divider {
		width: 1px;
		height: 18px;
		background-color: var(--clr-border-3);
	}

	/* RULER INPUT */
	.message-textarea__ruler-input-wrapper {
		display: flex;
		align-items: center;
		padding: 0 4px;
		gap: 5px;

		&.disabled {
			opacity: 0.5;
			pointer-events: none;
		}
	}

	.message-textarea__ruler-input {
		width: 30px;
		padding: 2px 0;
		text-align: center;

		/* remove numver arrows */
		&::-webkit-inner-spin-button,
		&::-webkit-outer-spin-button {
			-webkit-appearance: none;
			margin: 0;
		}
	}

	/*  */
	.message-textarea__inner {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		overflow: hidden;
	}

	.message-textarea__wrapper {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}

	/* MODAL */
	.modal-footer {
		display: flex;
		width: 100%;
		gap: 6px;
	}

	.modal-footer__checkbox {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 8px;
	}
</style>
