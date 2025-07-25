<script lang="ts">
	import { goto } from '$app/navigation';
	import Login from '$components/Login.svelte';
	import WelcomeSigninAction from '$components/WelcomeSigninAction.svelte';
	import { invoke } from '$lib/backend/ipc';
	import { SettingsService } from '$lib/config/appSettingsV2';
	import { showError } from '$lib/notifications/toasts';
	import { ProjectsService } from '$lib/project/projectsService';
	import { SETTINGS, type Settings, type CodeEditorSettings } from '$lib/settings/userSettings';
	import { UpdaterService } from '$lib/updater/updater';
	import { UserService } from '$lib/user/userService';
	import { copyToClipboard } from '@gitbutler/shared/clipboard';
	import { getContextStoreBySymbol } from '@gitbutler/shared/context';
	import { getContext } from '@gitbutler/shared/context';
	import Button from '@gitbutler/ui/Button.svelte';
	import Icon from '@gitbutler/ui/Icon.svelte';
	import Modal from '@gitbutler/ui/Modal.svelte';
	import SectionCard from '@gitbutler/ui/SectionCard.svelte';
	import Spacer from '@gitbutler/ui/Spacer.svelte';
	import Textbox from '@gitbutler/ui/Textbox.svelte';
	import Toggle from '@gitbutler/ui/Toggle.svelte';
	import Select from '@gitbutler/ui/select/Select.svelte';
	import SelectItem from '@gitbutler/ui/select/SelectItem.svelte';
	import * as toasts from '@gitbutler/ui/toasts';
	import type { User } from '$lib/user/user';
	import type { Writable } from 'svelte/store';

	const userService = getContext(UserService);
	const settingsService = getContext(SettingsService);
	const projectsService = getContext(ProjectsService);
	const user = userService.user;

	const updaterService = getContext(UpdaterService);
	const disableAutoChecks = updaterService.disableAutoChecks;

	const fileTypes = ['image/jpeg', 'image/png'];

	let saving = $state(false);
	let newName = $state('');
	let isDeleting = $state(false);
	let loaded = $state(false);

	let userPicture = $state($user?.picture);

	let deleteConfirmationModal: ReturnType<typeof Modal> | undefined = $state();

	const userSettings = getContextStoreBySymbol<Settings, Writable<Settings>>(SETTINGS);
	const editorOptions: CodeEditorSettings[] = [
		{ schemeIdentifer: 'vscodium', displayName: 'VSCodium' },
		{ schemeIdentifer: 'vscode', displayName: 'VSCode' },
		{ schemeIdentifer: 'vscode-insiders', displayName: 'VSCode Insiders' },
		{ schemeIdentifer: 'windsurf', displayName: 'Windsurf' },
		{ schemeIdentifer: 'zed', displayName: 'Zed' },
		{ schemeIdentifer: 'cursor', displayName: 'Cursor' }
	];
	const editorOptionsForSelect = editorOptions.map((option) => ({
		label: option.displayName,
		value: option.schemeIdentifer
	}));

	$effect(() => {
		if ($user && !loaded) {
			loaded = true;
			userService.getUser().then((cloudUser) => {
				const userData: User = {
					...cloudUser,
					name: cloudUser.name || 'unknown',
					email: cloudUser.email || 'unknown@example.com',
					login: cloudUser.login || undefined,
					picture: cloudUser.picture || '#',
					locale: cloudUser.locale || 'en',
					access_token: cloudUser.access_token || 'impossible-situation',
					role: cloudUser.role || 'user',
					supporter: cloudUser.supporter || false,
					github_access_token: $user?.github_access_token,
					github_username: $user?.github_username
				};
				userPicture = userData.picture;
				userService.setUser(userData);
			});
			newName = $user?.name || '';
		}
	});

	async function onSubmit(e: SubmitEvent) {
		if (!$user) return;
		saving = true;

		const target = e.target as HTMLFormElement;
		const formData = new FormData(target);
		const picture = formData.get('picture') as File | undefined;

		try {
			const updatedUser = await userService.updateUser({
				name: newName,
				picture: picture
			});
			updatedUser.github_access_token = $user?.github_access_token; // prevent overwriting with null
			userService.setUser(updatedUser);
			toasts.success('Profile updated');
		} catch (err: any) {
			console.error(err);
			showError('Failed to update user', err);
		}
		saving = false;
	}

	function onPictureChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];

		if (file && fileTypes.includes(file.type)) {
			userPicture = URL.createObjectURL(file);
		} else {
			userPicture = $user?.picture;
			toasts.error('Please use a valid image file');
		}
	}

	async function onDeleteClicked() {
		isDeleting = true;
		try {
			await settingsService.deleteAllData();
			await projectsService.reload();
			projectsService.unsetLastOpenedProject();
			await userService.logout();
			// TODO: Delete user from observable!!!
			toasts.success('All data deleted');
			goto('/', { replaceState: true, invalidateAll: true });
		} catch (err: any) {
			console.error(err);
			showError('Failed to delete project', err);
		} finally {
			deleteConfirmationModal?.close();
			isDeleting = false;
		}
	}

	async function installCli() {
		await invoke('install_cli');
	}

	async function cli_command(): Promise<string> {
		const path: string = await invoke('cli_path');
		const command = 'ln -sf ' + path + ' /usr/local/bin/but';
		return command;
	}

	let showSymlink = $state(false);
</script>

{#if $user}
	<SectionCard>
		<form onsubmit={onSubmit} class="profile-form">
			<label id="profile-picture" class="profile-pic-wrapper focus-state" for="picture">
				<input
					onchange={onPictureChange}
					type="file"
					id="picture"
					name="picture"
					accept={fileTypes.join(',')}
					class="hidden-input"
				/>

				{#if $user.picture}
					<img class="profile-pic" src={userPicture} alt="" referrerpolicy="no-referrer" />
				{/if}

				<span class="profile-pic__edit-label text-11 text-semibold">Edit</span>
			</label>

			<div id="contact-info" class="contact-info">
				<div class="contact-info__fields">
					<Textbox label="Full name" bind:value={newName} required />
					<Textbox label="Email" bind:value={$user.email} readonly />
				</div>

				<Button type="submit" style="pop" loading={saving}>Update profile</Button>
			</div>
		</form>
	</SectionCard>
{:else}
	<WelcomeSigninAction />
{/if}
<Spacer />

<SectionCard orientation="row" centerAlign>
	{#snippet title()}
		Default code editor
	{/snippet}
	{#snippet actions()}
		<Select
			value={$userSettings.defaultCodeEditor.schemeIdentifer}
			options={editorOptionsForSelect}
			onselect={(value) => {
				const selected = editorOptions.find((option) => option.schemeIdentifer === value);
				if (selected) {
					userSettings.update((s) => ({ ...s, defaultCodeEditor: selected }));
				}
			}}
		>
			{#snippet itemSnippet({ item, highlighted })}
				<SelectItem
					selected={item.value === $userSettings.defaultCodeEditor.schemeIdentifer}
					{highlighted}
				>
					{item.label}
				</SelectItem>
			{/snippet}
		</Select>
	{/snippet}
</SectionCard>

<SectionCard labelFor="disable-auto-checks" orientation="row">
	{#snippet title()}
		Automatically check for updates
	{/snippet}

	{#snippet caption()}
		Automatically check for updates. You can still check manually when needed.
	{/snippet}

	{#snippet actions()}
		<Toggle
			id="disable-auto-checks"
			checked={!$disableAutoChecks}
			onclick={() => ($disableAutoChecks = !$disableAutoChecks)}
		/>
	{/snippet}
</SectionCard>

{#if $user && $user.role?.includes('admin')}
	<SectionCard orientation="column">
		{#snippet title()}
			Install the GitButler CLI (but)
		{/snippet}

		{#snippet caption()}
			Installs the GitButler CLI (but) in your PATH, allowing you to use it from the terminal. This
			action will request admin privileges. Alternatively, you could create a symlink manually.

			{#if showSymlink}
				<div class="symlink-copy-box">
					{#await cli_command() then command}
						<p>{command}</p>
						<button
							type="button"
							class="symlink-copy-icon"
							onclick={() => copyToClipboard(command)}
						>
							<Icon name="copy" />
						</button>
					{/await}
				</div>
			{/if}
		{/snippet}

		<div class="flex flex-col gap-16">
			<div class="flex gap-8 justify-end">
				<Button style="pop" icon="play" onclick={() => installCli()}>Install But CLI</Button>
				<Button
					style="neutral"
					kind="outline"
					disabled={showSymlink}
					onclick={() => (showSymlink = !showSymlink)}>Show symlink</Button
				>
			</div>
		</div>
	</SectionCard>
{/if}

<Spacer />

{#if $user}
	<SectionCard orientation="row">
		{#snippet title()}
			Signing out
		{/snippet}
		{#snippet caption()}
			Ready to take a break? Click here to log out and unwind.
		{/snippet}

		<Login />
	</SectionCard>
{/if}

<SectionCard orientation="row">
	{#snippet title()}
		Remove all projects
	{/snippet}
	{#snippet caption()}
		You can delete all projects from the GitButler app.
		<br />
		Your code remains safe. it only clears the configuration.
	{/snippet}

	<Button style="error" kind="outline" onclick={() => deleteConfirmationModal?.show()}>
		Remove projects…
	</Button>

	<Modal
		bind:this={deleteConfirmationModal}
		width="small"
		title="Remove all projects"
		onSubmit={onDeleteClicked}
	>
		<p>Are you sure you want to remove all GitButler projects?</p>

		{#snippet controls(close)}
			<Button style="error" kind="outline" loading={isDeleting} type="submit">Remove</Button>
			<Button style="pop" onclick={close}>Cancel</Button>
		{/snippet}
	</Modal>
</SectionCard>

<style lang="postcss">
	.profile-form {
		display: flex;
		gap: 24px;
	}

	.hidden-input {
		z-index: var(--z-ground);
		position: absolute;
		width: 100%;
		height: 100%;
		cursor: pointer;
		opacity: 0;
	}

	.profile-pic-wrapper {
		position: relative;
		width: 100px;
		height: 100px;
		overflow: hidden;
		border-radius: var(--radius-m);
		background-color: var(--clr-scale-pop-70);
		transition: opacity var(--transition-medium);

		&:hover,
		&:focus-within {
			& .profile-pic__edit-label {
				opacity: 1;
			}

			& .profile-pic {
				opacity: 0.8;
			}
		}
	}

	.profile-pic {
		width: 100%;
		height: 100%;

		object-fit: cover;
		background-color: var(--clr-scale-pop-70);
	}

	.profile-pic__edit-label {
		position: absolute;
		bottom: 8px;
		left: 8px;
		padding: 4px 6px;
		border-radius: var(--radius-m);
		background-color: var(--clr-scale-ntrl-20);
		color: var(--clr-core-ntrl-100);
		opacity: 0;
		transition: opacity var(--transition-medium);
	}

	.contact-info {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: flex-end;
		gap: 20px;
	}

	.contact-info__fields {
		display: flex;
		flex-direction: column;
		width: 100%;
		gap: 12px;
	}

	.symlink-copy-box {
		display: flex;
		margin-top: 16px;
		padding: 8px 10px;
		gap: 10px;
		border: 1px solid var(--clr-border-3);
		border-radius: var(--radius-m);
		background-color: var(--clr-bg-1-muted);
		color: var(--clr-text-1);
		font-size: 12px;
		font-family: var(--fontfamily-mono);
		word-break: break-all;
	}

	.symlink-copy-icon {
		display: flex;
		color: var(--clr-text-3);
		transition: color var(--transition-fast);

		&:hover {
			color: var(--clr-text-2);
		}
	}
</style>
