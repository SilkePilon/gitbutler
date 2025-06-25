<script lang="ts">
	import { getContext } from '@gitbutler/shared/context';
	import RegisterInterest from '@gitbutler/shared/interest/RegisterInterest.svelte';
	import Loading from '@gitbutler/shared/network/Loading.svelte';
	import { HttpClient } from '@gitbutler/shared/network/httpClient';
	import CreateOrganizationModal from '@gitbutler/shared/organizations/CreateOrganizationModal.svelte';
	import JoinOrganizationModal from '@gitbutler/shared/organizations/JoinOrganizationModal.svelte';
	import { OrganizationService } from '@gitbutler/shared/organizations/organizationService';
	import { organizationTable } from '@gitbutler/shared/organizations/organizationsSlice';
	import { AppState } from '@gitbutler/shared/redux/store.svelte';
	import Button from '@gitbutler/ui/Button.svelte';
	import EmptyStatePlaceholder from '@gitbutler/ui/EmptyStatePlaceholder.svelte';
	import Icon from '@gitbutler/ui/Icon.svelte';
	import SectionCard from '@gitbutler/ui/SectionCard.svelte';

	const organizationService = getContext(OrganizationService);
	const appState = getContext(AppState);
	const httpClient = getContext(HttpClient);
	const authenticated = httpClient.authenticationAvailable;

	const organizationsInterest = organizationService.getOrganizationListingInterest();
	const organizations = $derived(organizationTable.selectors.selectAll(appState.organizations));

	let joinOrganizationModal: JoinOrganizationModal;
	let createOrganizationModal: CreateOrganizationModal;

	function getOrganizationProjectsCount(organization: any) {
		return organization.projectRepositoryIds?.length || 0;
	}

	function getOrganizationMembersCount(organization: any) {
		return organization.memberLogins?.length || 0;
	}

	function navigateToOrganization(slug: string) {
		window.location.href = `/${slug}`;
	}
</script>

{#if $authenticated}
	<RegisterInterest interest={organizationsInterest} />
{/if}

<JoinOrganizationModal bind:this={joinOrganizationModal} />
<CreateOrganizationModal bind:this={createOrganizationModal} />

<div class="page-container">
	<header class="page-header">
		<div class="page-title">
			<Icon name="settings" />
			<h1>Organizations</h1>
		</div>
		<p class="page-description">Manage your organizations and team collaboration settings</p>
	</header>

	<div class="content-wrapper">
		<div class="main-content">
			<!-- Create Organization Card -->
			<div class="create-org-section">
				<button
					type="button"
					class="create-org-card"
					onclick={() => createOrganizationModal?.show()}
				>
					<svg
						class="create-org-icon"
						stroke="currentColor"
						fill="none"
						viewBox="0 0 48 48"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 20h10m-6 4v10m5-15V8a1 1 0 00-1-1H9a1 1 0 00-1 1v11M7 10h4m6 8h6v-1a1 1 0 011-1h2a1 1 0 011 1v1h2"
						/>
					</svg>
					<span class="create-org-text">Create a new organization</span>
					<p class="create-org-description">
						Set up a new organization to collaborate with your team
					</p>
				</button>
			</div>

			<!-- OR Separator -->
			<div class="or-separator">
				<div class="separator-line"></div>
				<span class="separator-text">OR</span>
				<div class="separator-line"></div>
			</div>

			<!-- Join Organization Card -->
			<div class="join-org-section">
				<button type="button" class="join-org-card" onclick={() => joinOrganizationModal?.show()}>
					<svg
						class="join-org-icon"
						stroke="currentColor"
						fill="none"
						viewBox="0 0 48 48"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
						/>
					</svg>
					<span class="join-org-text">Join an organization</span>
					<p class="join-org-description">
						Have an invitation code? Join an existing organization to start collaborating
					</p>
				</button>
			</div>

			{#if organizations.length > 0}
				<div class="organizations-header">
					<h2>Your Organizations</h2>
				</div>

				<div class="organizations-grid">
					{#each organizations as organization (organization.id)}
						<Loading loadable={organization}>
							{#snippet children(organization)}
								<div class="organization-card">
									<div class="org-card-header">
										<div
											class="organization-avatar"
											style:background-color="var(--clr-scale-ntrl-20)"
											style:color="var(--clr-scale-ntrl-80)"
										>
											<span>{(organization.name || organization.slug)[0].toUpperCase()}</span>
										</div>
										<div class="organization-info">
											<h3 class="organization-name">
												{organization.name || organization.slug}
											</h3>
											{#if organization.name}
												<p class="organization-slug">@{organization.slug}</p>
											{/if}
										</div>
									</div>

									<div class="organization-stats">
										<div class="stat">
											<Icon name="profile" />
											<span>{getOrganizationMembersCount(organization)} members</span>
										</div>
										<div class="stat">
											<Icon name="search" />
											<span>{getOrganizationProjectsCount(organization)} projects</span>
										</div>
									</div>

									<div class="org-card-actions">
										<Button
											kind="outline"
											onclick={() => navigateToOrganization(organization.slug)}
											style="width: 100%;"
										>
											View Organization
										</Button>
									</div>
								</div>
							{/snippet}
						</Loading>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>

<style lang="postcss">
	.page-container {
		min-width: 900px;
		max-width: 1200px;
		margin: 0 auto;
		padding: 24px;
	}

	@media (max-width: 900px) {
		.page-container {
			min-width: 90%;
		}
	}

	.page-header {
		margin-bottom: 32px;
	}

	.page-title {
		display: flex;
		align-items: center;
		margin-bottom: 8px;
		gap: 12px;
	}

	.page-title h1 {
		color: var(--clr-text-1);
		font-weight: 600;
		font-size: 24px;
	}

	.page-description {
		color: var(--clr-text-2);
		font-size: 14px;
	}

	.content-wrapper {
		display: flex;
		gap: 24px;
	}

	.main-content {
		flex: 1;
		min-width: 0; /* Prevent flex item from overflowing */
	}

	/* Create Organization Card */
	.create-org-section {
		margin-bottom: 24px;
	}

	/* OR Separator */
	.or-separator {
		display: flex;
		align-items: center;
		margin: 24px 0;
	}

	.separator-line {
		flex: 1;
		height: 1px;
		background: var(--clr-border-2);
	}

	.separator-text {
		padding: 0 16px;
		color: var(--clr-text-2);
		font-weight: 600;
		font-size: 14px;
		letter-spacing: 0.5px;
	}

	/* Join Organization Section */
	.join-org-section {
		margin-bottom: 32px;
	}

	.create-org-card {
		display: block;
		position: relative;
		width: 100%;
		padding: 40px 24px;
		border: 2px dashed var(--clr-border-2);
		border-radius: 16px;
		background: var(--clr-bg-1);
		box-shadow: 0 1px 3px color-mix(in srgb, var(--clr-text-1) 5%, transparent);
		text-align: center;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.create-org-card:hover {
		transform: translateY(-1px);
		border-color: var(--clr-theme-pop-element);
		background: var(--clr-bg-1-muted);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--clr-theme-pop-element) 10%, transparent);
	}

	.create-org-card:focus {
		border-color: var(--clr-theme-pop-element);
		outline: none;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--clr-theme-pop-element) 10%, transparent);
	}

	.create-org-icon {
		width: 56px;
		height: 56px;
		margin: 0 auto 20px;
		color: var(--clr-text-2);
		transition: color 0.2s ease;
	}

	.create-org-card:hover .create-org-icon {
		color: var(--clr-theme-pop-element);
	}

	.create-org-text {
		display: block;
		margin-bottom: 8px;
		color: var(--clr-text-1);
		font-weight: 600;
		font-size: 18px;
	}

	.create-org-description {
		margin: 0;
		color: var(--clr-text-2);
		font-size: 14px;
		line-height: 1.5;
	}

	.organizations-header {
		margin-bottom: 24px;
	}

	.organizations-header h2 {
		color: var(--clr-text-1);
		font-weight: 600;
		font-size: 20px;
	}

	/* Organization Grid */
	.organizations-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: 24px;
	}

	.organization-card {
		position: relative;
		padding: 28px;
		overflow: hidden;
		border: 1px solid var(--clr-border-2);
		border-radius: 16px;
		background: var(--clr-bg-1);
		box-shadow: 0 1px 3px color-mix(in srgb, var(--clr-text-1) 5%, transparent);
		transition: all 0.3s ease;
	}

	.organization-card::before {
		position: absolute;
		top: 0;
		right: 0;
		left: 0;
		height: 3px;
		background: linear-gradient(90deg, var(--clr-theme-pop-element), var(--clr-theme-purp-element));
		content: '';
	}

	.organization-card:hover {
		transform: translateY(-2px);
		border-color: var(--clr-border-1);
		box-shadow: 0 10px 25px color-mix(in srgb, var(--clr-text-1) 10%, transparent);
	}

	.org-card-header {
		display: flex;
		align-items: center;
		margin-bottom: 20px;
		gap: 16px;
	}

	.organization-avatar {
		display: flex;
		flex-shrink: 0;
		align-items: center;
		justify-content: center;
		width: 52px;
		height: 52px;
		border-radius: 12px;
		background: linear-gradient(
			135deg,
			var(--clr-theme-pop-element),
			var(--clr-theme-purp-element)
		);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--clr-theme-pop-element) 30%, transparent);
		color: var(--clr-core-ntrl-100);
		font-weight: 700;
		font-size: 22px;
	}

	.organization-info {
		flex: 1;
		min-width: 0;
	}

	.organization-name {
		margin: 0 0 4px 0;
		color: var(--clr-text-1);
		font-weight: 700;
		font-size: 20px;
		line-height: 1.2;
	}

	.organization-slug {
		margin: 0;
		color: var(--clr-text-2);
		font-size: 14px;
	}

	.organization-stats {
		display: flex;
		margin-bottom: 24px;
		padding: 20px;
		gap: 24px;
		border: 1px solid var(--clr-border-3);
		border-radius: 12px;
		background: var(--clr-bg-2);
	}

	.stat {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--clr-text-1);
		font-weight: 600;
		font-size: 14px;
	}

	.org-card-actions {
		margin-top: auto;
	}

	.join-org-card {
		display: block;
		position: relative;
		width: 100%;
		padding: 40px 24px;
		border: 2px solid var(--clr-border-2);
		border-radius: 16px;
		background: var(--clr-bg-1);
		box-shadow: 0 1px 3px color-mix(in srgb, var(--clr-text-1) 5%, transparent);
		text-align: center;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.join-org-card:hover {
		transform: translateY(-1px);
		border-color: var(--clr-theme-pop-element);
		background: var(--clr-bg-1-muted);
		box-shadow: 0 4px 12px color-mix(in srgb, var(--clr-theme-pop-element) 10%, transparent);
	}

	.join-org-card:focus {
		border-color: var(--clr-theme-pop-element);
		outline: none;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--clr-theme-pop-element) 10%, transparent);
	}

	.join-org-icon {
		width: 56px;
		height: 56px;
		margin: 0 auto 20px;
		color: var(--clr-text-2);
		transition: color 0.2s ease;
	}

	.join-org-card:hover .join-org-icon {
		color: var(--clr-theme-pop-element);
	}

	.join-org-text {
		display: block;
		margin-bottom: 8px;
		color: var(--clr-text-1);
		font-weight: 600;
		font-size: 18px;
	}

	.join-org-description {
		margin: 0;
		color: var(--clr-text-2);
		font-size: 14px;
		line-height: 1.5;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.organizations-grid {
			grid-template-columns: 1fr;
		}

		.create-org-card {
			padding: 32px 20px;
		}

		.join-org-card {
			padding: 32px 20px;
		}

		.organization-stats {
			flex-direction: column;
			gap: 12px;
		}
	}
</style>
