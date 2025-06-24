<script lang="ts">
	import { onMount } from 'svelte';
	import FullviewLoading from '$components/FullviewLoading.svelte';
	import Resizer from '$components/Resizer.svelte';
	import BranchesListGroup from '$components/v3/branchesPage/BranchesListGroup.svelte';
	import BranchesCardTemplate from '$components/v3/branchesPage/BranchesCardTemplate.svelte';
	import Markdown from '@gitbutler/ui/markdown/Markdown.svelte';
	import { FileService } from '$lib/files/fileService';
	import { RemotesService, type GitRemote } from '$lib/remotes/remotesService';
	import { Project } from '$lib/project/project';
	import { Tauri } from '$lib/backend/tauri';
	import { UiState } from '$lib/state/uiState.svelte';
	import { AIService } from '$lib/ai/service';
	import { MessageRole } from '$lib/ai/types';
	import { getContext } from '@gitbutler/shared/context';
	import { inject } from '@gitbutler/shared/context';
	import Button from '@gitbutler/ui/Button.svelte';
	import Icon from '@gitbutler/ui/Icon.svelte';
	import FileListItemV3 from '@gitbutler/ui/file/FileListItemV3.svelte';
	import FolderListItem from '@gitbutler/ui/file/FolderListItem.svelte';
	import FileIcon from '@gitbutler/ui/file/FileIcon.svelte';

	interface Props {
		projectId: string;
	}

	const { projectId }: Props = $props();

	const project = getContext(Project);
	const tauri = getContext(Tauri);
	const aiService = getContext(AIService);
	const fileService = new FileService(tauri);
	const remotesService = getContext(RemotesService);
	const [uiState] = inject(UiState);

	const sidebarWidth = $derived(uiState.global.historySidebarWidth);

	let remotes = $state<GitRemote[]>([]);
	let readmeContent = $state<string>('');
	let readmeExists = $state<boolean>(false);
	let editingReadme = $state<boolean>(false);
	let editedReadmeContent = $state<string>('');
	let loadingRemotes = $state<boolean>(true);
	let loadingReadme = $state<boolean>(true);
	let savingReadme = $state<boolean>(false);
	
	// Changelog state
	let changelogContent = $state<string>('');
	let changelogExists = $state<boolean>(false);
	let editingChangelog = $state<boolean>(false);
	let editedChangelogContent = $state<string>('');
	let loadingChangelog = $state<boolean>(true);
	let savingChangelog = $state<boolean>(false);
	let generatingChangelogEntry = $state<boolean>(false);
	
	let repoStats = $state({
		totalCommits: 0,
		totalBranches: 0,
		totalContributors: 0,
		lastCommitDate: null as Date | null,
		mainBranch: 'main',
		repoSize: '0 MB',
		// Data for line graphs
		commitHistory: [] as { date: string; commits: number }[],
		branchHistory: [] as { date: string; branches: number }[],
		contributorHistory: [] as { date: string; contributors: number }[]
	});
	let loadingStats = $state<boolean>(true);

	// Project files state for file browser
	let projectFiles = $state<ProjectFileNode[]>([]);
	let loadingFiles = $state<boolean>(true);
	let selectedFilePath = $state<string | null>(null);
	let filePreviewContent = $state<string>('');
	let loadingFilePreview = $state<boolean>(false);

	// File tree node structure
	interface ProjectFileNode {
		name: string;
		path: string;
		isDirectory: boolean;
		isExpanded?: boolean;
		children?: ProjectFileNode[];
		size?: number;
		lastModified?: Date;
	}

	// Selection state to mimic branches page behavior
	let selectedItem = $state<'stats' | 'remotes' | 'readme' | 'changelog' | null>('stats');

	// Layout refs
	let leftPanel = $state<HTMLDivElement>();
	let rightPanel = $state<HTMLDivElement>();

	async function loadRepoInfo() {
		try {
			loadingRemotes = true;
			loadingStats = true;
			loadingFiles = true;

			console.log('Loading remotes for project:', projectId);
			remotes = await remotesService.remotes(projectId);
			console.log('Loaded remotes:', remotes);

			// Mock repository statistics - in a real app, you'd fetch these from the backend
			await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate API call
			
			// Generate mock data for line graphs
			const generateMockHistoryData = (baseValue: number, days: number = 30): { date: string; value: number }[] => {
				const data: { date: string; value: number }[] = [];
				for (let i = days; i >= 0; i--) {
					const date = new Date();
					date.setDate(date.getDate() - i);
					const variation = Math.random() * 0.3 - 0.15; // ±15% variation
					const value = Math.max(1, Math.floor(baseValue * (1 + variation * (days - i) / days)));
					data.push({
						date: date.toISOString().split('T')[0] as string,
						value
					});
				}
				return data;
			};

			const totalCommits = Math.floor(Math.random() * 1000) + 100;
			const totalBranches = Math.floor(Math.random() * 20) + 3;
			const totalContributors = Math.floor(Math.random() * 10) + 1;

			repoStats = {
				totalCommits,
				totalBranches,
				totalContributors,
				lastCommitDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
				mainBranch: 'main',
				repoSize: `${(Math.random() * 50 + 5).toFixed(1)} MB`,
				commitHistory: generateMockHistoryData(totalCommits).map(d => ({ date: d.date, commits: d.value })),
				branchHistory: generateMockHistoryData(totalBranches).map(d => ({ date: d.date, branches: d.value })),
				contributorHistory: generateMockHistoryData(totalContributors).map(d => ({ date: d.date, contributors: d.value }))
			};

			// Generate mock project files structure
			projectFiles = generateMockProjectFiles();

		} catch (error) {
			console.error('Failed to load repository info:', error);
			remotes = [];
		} finally {
			loadingRemotes = false;
			loadingStats = false;
			loadingFiles = false;
		}
	}

	function generateMockProjectFiles(): ProjectFileNode[] {
		// Generate a realistic project structure
		return [
			{
				name: 'src',
				path: 'src',
				isDirectory: true,
				isExpanded: true,
				children: [
					{
						name: 'components',
						path: 'src/components',
						isDirectory: true,
						isExpanded: false,
						children: [
							{ name: 'Button.svelte', path: 'src/components/Button.svelte', isDirectory: false, size: 2480, lastModified: new Date('2024-01-15') },
							{ name: 'Modal.svelte', path: 'src/components/Modal.svelte', isDirectory: false, size: 3850, lastModified: new Date('2024-01-12') },
							{ name: 'Input.svelte', path: 'src/components/Input.svelte', isDirectory: false, size: 1920, lastModified: new Date('2024-01-10') }
						]
					},
					{
						name: 'lib',
						path: 'src/lib',
						isDirectory: true,
						isExpanded: false,
						children: [
							{ name: 'api.ts', path: 'src/lib/api.ts', isDirectory: false, size: 4560, lastModified: new Date('2024-01-14') },
							{ name: 'utils.ts', path: 'src/lib/utils.ts', isDirectory: false, size: 2340, lastModified: new Date('2024-01-13') },
							{ name: 'types.ts', path: 'src/lib/types.ts', isDirectory: false, size: 1680, lastModified: new Date('2024-01-11') }
						]
					},
					{ name: 'app.ts', path: 'src/app.ts', isDirectory: false, size: 890, lastModified: new Date('2024-01-16') },
					{ name: 'main.ts', path: 'src/main.ts', isDirectory: false, size: 456, lastModified: new Date('2024-01-16') }
				]
			},
			{
				name: 'public',
				path: 'public',
				isDirectory: true,
				isExpanded: false,
				children: [
					{ name: 'index.html', path: 'public/index.html', isDirectory: false, size: 1240, lastModified: new Date('2024-01-05') },
					{ name: 'favicon.ico', path: 'public/favicon.ico', isDirectory: false, size: 2048, lastModified: new Date('2024-01-01') }
				]
			},
			{
				name: 'docs',
				path: 'docs',
				isDirectory: true,
				isExpanded: false,
				children: [
					{ name: 'README.md', path: 'docs/README.md', isDirectory: false, size: 3456, lastModified: new Date('2024-01-14') },
					{ name: 'CONTRIBUTING.md', path: 'docs/CONTRIBUTING.md', isDirectory: false, size: 2890, lastModified: new Date('2024-01-08') }
				]
			},
			{ name: 'package.json', path: 'package.json', isDirectory: false, size: 1567, lastModified: new Date('2024-01-15') },
			{ name: 'tsconfig.json', path: 'tsconfig.json', isDirectory: false, size: 890, lastModified: new Date('2024-01-10') },
			{ name: 'vite.config.ts', path: 'vite.config.ts', isDirectory: false, size: 1230, lastModified: new Date('2024-01-12') },
			{ name: '.gitignore', path: '.gitignore', isDirectory: false, size: 456, lastModified: new Date('2024-01-01') }
		];
	}

	function toggleFileFolder(node: ProjectFileNode) {
		if (node.isDirectory) {
			node.isExpanded = !node.isExpanded;
			projectFiles = [...projectFiles]; // Trigger reactivity
		}
	}

	async function selectFile(filePath: string) {
		if (selectedFilePath === filePath) {
			selectedFilePath = null;
			filePreviewContent = '';
			return;
		}

		selectedFilePath = filePath;
		loadingFilePreview = true;

		try {
			// Mock file content based on file type
			await new Promise((resolve) => setTimeout(resolve, 300)); // Simulate loading
			
			const fileExtension = filePath.split('.').pop()?.toLowerCase();
			
			switch (fileExtension) {
				case 'json':
					filePreviewContent = JSON.stringify({
						name: project.title,
						version: "1.0.0",
						description: "A GitButler project",
						main: "src/main.ts",
						scripts: {
							dev: "vite",
							build: "vite build",
							preview: "vite preview"
						}
					}, null, 2);
					break;
				case 'md':
					filePreviewContent = `# ${project.title}

A modern web application built with GitButler.

## Getting Started

npm install
npm run dev

## Features

- Modern UI components
- Fast development workflow
- Optimized builds`;
					break;
				case 'ts':
				case 'js':
					filePreviewContent = `// ${filePath}
import { createApp } from './app';

// Initialize the application
async function main() {
  try {
    const app = createApp();
    app.mount('#app');
    console.log('Application started successfully');
  } catch (error) {
    console.error('Failed to start application:', error);
  }
}

main();`;
					break;
				case 'svelte':
					filePreviewContent = `// ${filePath}
// Svelte Component File
// This file contains a Svelte component with script, template, and style sections.

// Component interface:
interface Props {
  variant?: string;
  disabled?: boolean;
}

// Component logic would be in the script section
// Template would contain the HTML markup
// Styles would define component-specific CSS`;
					break;
				default:
					filePreviewContent = `// ${filePath}

This is a preview of the file content.
In a real application, this would load the actual file content from the workspace.

File path: ${filePath}
Project: ${project.title}
Last modified: ${new Date().toLocaleDateString()}`;
			}
		} catch (error) {
			console.error('Failed to load file preview:', error);
			filePreviewContent = 'Error loading file preview.';
		} finally {
			loadingFilePreview = false;
		}
	}

	async function loadReadme() {
		try {
			loadingReadme = true;
			const readmeFiles = ['README.md', 'readme.md', 'README.txt', 'readme.txt', 'README'];

			let readmeFound = false;
			for (const filename of readmeFiles) {
				try {
					const fileData = await fileService.readFromWorkspace(filename, projectId);
					if (fileData.data.content) {
						readmeContent = fileData.data.content;
						readmeExists = true;
						readmeFound = true;
						break;
					}
				} catch {
					// Try next README filename
					continue;
				}
			}

			if (!readmeFound) {
				readmeExists = false;
				readmeContent = 'No README file found in this repository.';
			}
		} catch (error) {
			console.error('Failed to load README:', error);
			readmeExists = false;
			readmeContent = 'Error loading README file.';
		} finally {
			loadingReadme = false;
		}
	}

	async function loadChangelog() {
		try {
			loadingChangelog = true;
			const changelogFiles = ['CHANGELOG.md', 'changelog.md', 'CHANGELOG.txt', 'changelog.txt', 'CHANGELOG'];

			let changelogFound = false;
			for (const filename of changelogFiles) {
				try {
					const fileData = await fileService.readFromWorkspace(filename, projectId);
					if (fileData.data.content) {
						changelogContent = fileData.data.content;
						changelogExists = true;
						changelogFound = true;
						break;
					}
				} catch {
					// Try next CHANGELOG filename
					continue;
				}
			}

			if (!changelogFound) {
				changelogExists = false;
				changelogContent = 'No CHANGELOG file found in this repository.';
			}
		} catch (error) {
			console.error('Failed to load CHANGELOG:', error);
			changelogExists = false;
			changelogContent = 'Error loading CHANGELOG file.';
		} finally {
			loadingChangelog = false;
		}
	}

	// Check if README content has changed
	const hasReadmeChanges = $derived(() => {
		if (!editingReadme) return false;
		// Use the actual readmeContent when it exists, empty string when creating new
		const originalContent = readmeExists ? readmeContent : '';
		const currentContent = editedReadmeContent;
		return currentContent !== originalContent;
	});

	// Check if CHANGELOG content has changed
	const hasChangelogChanges = $derived(() => {
		if (!editingChangelog) return false;
		// Use the actual changelogContent when it exists, empty string when creating new
		const originalContent = changelogExists ? changelogContent : '';
		const currentContent = editedChangelogContent;
		return currentContent !== originalContent;
	});

	function startEditingReadme() {
		editingReadme = true;
		// If README exists, use its content; otherwise start with empty string
		editedReadmeContent = readmeExists ? readmeContent : '';
	}

	function cancelEditingReadme() {
		editingReadme = false;
		editedReadmeContent = '';
	}

	async function saveReadme() {
		try {
			savingReadme = true;

			// Write the README file to the workspace
			await fileService.writeToWorkspace('README.md', projectId, editedReadmeContent);

			readmeContent = editedReadmeContent;
			readmeExists = true;
			editingReadme = false;
			editedReadmeContent = '';
		} catch (error) {
			console.error('Failed to save README:', error);
		} finally {
			savingReadme = false;
		}
	}

	function startEditingChangelog() {
		editingChangelog = true;
		// If CHANGELOG exists, use its content; otherwise start with empty string
		editedChangelogContent = changelogExists ? changelogContent : '';
	}

	function cancelEditingChangelog() {
		editingChangelog = false;
		editedChangelogContent = '';
	}

	async function saveChangelog() {
		try {
			savingChangelog = true;

			// Write the CHANGELOG file to the workspace
			await fileService.writeToWorkspace('CHANGELOG.md', projectId, editedChangelogContent);

			changelogContent = editedChangelogContent;
			changelogExists = true;
			editingChangelog = false;
			editedChangelogContent = '';
		} catch (error) {
			console.error('Failed to save CHANGELOG:', error);
		} finally {
			savingChangelog = false;
		}
	}

	async function generateChangelogEntry() {
		try {
			generatingChangelogEntry = true;
			
			// Use AI to generate a changelog entry
			const today = new Date().toISOString().split('T')[0];
			
			// Check if we already have content to determine if this is a new entry or first entry
			const hasExistingContent = editedChangelogContent && editedChangelogContent.trim();
			const hasChangelogHeaders = hasExistingContent && editedChangelogContent.includes('# Changelog');
			
			const prompt = [
				{
					role: MessageRole.System,
					content: 'You are an expert technical writer helping to generate changelog entries for software projects. Create professional changelog entries in standard Keep a Changelog format.'
				},
				{
					role: MessageRole.User,
					content: hasChangelogHeaders 
						? `Generate ONLY a new version entry for today (${today}) to add to an existing changelog. The entry should:

1. Start with "## [Unreleased] - ${today}" (or increment version if appropriate)
2. Include sections for Added, Changed, Fixed, and Security as appropriate
3. Provide realistic but different examples that a developer could customize
4. Focus on user-facing changes and improvements
5. Be professional and clear
6. DO NOT include changelog headers like "# Changelog" or "All notable changes..."
7. Generate content that is different from previous entries

Please generate ONLY the new version entry without any headers or explanations.`
						: `Generate a complete changelog file for today (${today}) for a software project. The entry should:

1. Start with proper changelog headers including "# Changelog" and description
2. Follow Keep a Changelog format (https://keepachangelog.com/)
3. Include an "[Unreleased]" version entry for today
4. Include sections for Added, Changed, Fixed, and Security as appropriate
5. Provide realistic but generic examples that a developer could customize
6. Focus on user-facing changes and improvements
7. Be professional and clear

Please generate the complete changelog structure.`
				}
			];

			const aiClient = await aiService.buildClient();
			if (!aiClient) {
				throw new Error('AI service not available. Please configure an AI provider in settings.');
			}

			const generatedEntry = await aiClient.evaluate(prompt, {
				maxTokens: 1000,
				onToken: (token) => {
					// Optional: Could show streaming updates here
				}
			});

			// Add the generated entry to the current content
			const currentContent = editedChangelogContent || '';
			let newContent;
			
			if (hasChangelogHeaders) {
				// Add new entry after existing headers, before previous entries
				const lines = currentContent.split('\n');
				const firstVersionIndex = lines.findIndex(line => line.startsWith('## '));
				
				if (firstVersionIndex > -1) {
					// Insert before first version entry
					const beforeVersion = lines.slice(0, firstVersionIndex).join('\n');
					const afterVersion = lines.slice(firstVersionIndex).join('\n');
					newContent = `${beforeVersion}\n${generatedEntry.trim()}\n\n${afterVersion}`;
				} else {
					// No existing versions, append after headers
					newContent = `${currentContent}\n\n${generatedEntry.trim()}`;
				}
			} else {
				// First entry or no headers, replace or add content
				newContent = currentContent ? `${generatedEntry.trim()}\n\n${currentContent}` : generatedEntry.trim();
			}
			
			editedChangelogContent = newContent;
			
		} catch (error) {
			console.error('Failed to generate changelog entry:', error);
			
			// Fallback to template if AI fails
			const today = new Date().toISOString().split('T')[0];
			const currentContent = editedChangelogContent || '';
			const hasChangelogHeaders = currentContent.includes('# Changelog');
			
			let fallbackEntry;
			if (hasChangelogHeaders) {
				// Just generate a new version entry
				fallbackEntry = `## [Unreleased] - ${today}

### Added
- New features and enhancements

### Changed
- Improvements and modifications

### Fixed
- Bug fixes and corrections

### Security
- Security-related updates`;
			} else {
				// Generate complete changelog structure
				fallbackEntry = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - ${today}

### Added
- New features and enhancements

### Changed
- Improvements and modifications

### Fixed
- Bug fixes and corrections

### Security
- Security-related updates`;
			}

			// Add the fallback entry to the current content
			let newContent;
			if (hasChangelogHeaders) {
				const lines = currentContent.split('\n');
				const firstVersionIndex = lines.findIndex(line => line.startsWith('## '));
				
				if (firstVersionIndex > -1) {
					const beforeVersion = lines.slice(0, firstVersionIndex).join('\n');
					const afterVersion = lines.slice(firstVersionIndex).join('\n');
					newContent = `${beforeVersion}\n${fallbackEntry}\n\n${afterVersion}`;
				} else {
					newContent = `${currentContent}\n\n${fallbackEntry}`;
				}
			} else {
				newContent = currentContent ? `${fallbackEntry}\n\n${currentContent}` : fallbackEntry;
			}
			
			editedChangelogContent = newContent;
		} finally {
			generatingChangelogEntry = false;
		}
	}

	function getRemoteDisplayName(remote: GitRemote): string {
		if (!remote.url) return remote.name || 'Unknown';

		// Extract readable name from common Git hosting providers
		if (remote.url.includes('github.com')) {
			const match = remote.url.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
			return match ? `GitHub: ${match[1]}` : `GitHub: ${remote.name}`;
		} else if (remote.url.includes('gitlab.com')) {
			const match = remote.url.match(/gitlab\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
			return match ? `GitLab: ${match[1]}` : `GitLab: ${remote.name}`;
		} else if (remote.url.includes('bitbucket.org')) {
			const match = remote.url.match(/bitbucket\.org[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
			return match ? `Bitbucket: ${match[1]}` : `Bitbucket: ${remote.name}`;
		}

		return `${remote.name}: ${remote.url}`;
	}

	// Simple line graph component function
	function createLineGraph(data: {date: string, value: number}[], color: string = '#007acc') {
		if (!data.length) return '';
		
		const width = 300;
		const height = 120;
		const padding = 20;
		const innerWidth = width - 2 * padding;
		const innerHeight = height - 2 * padding;
		
		const maxValue = Math.max(...data.map(d => d.value));
		const minValue = Math.min(...data.map(d => d.value));
		const valueRange = maxValue - minValue || 1;
		
		const points = data.map((d, i) => {
			const x = padding + (i / (data.length - 1)) * innerWidth;
			const y = height - padding - ((d.value - minValue) / valueRange) * innerHeight;
			return `${x},${y}`;
		}).join(' ');
		
		return `
			<svg width="${width}" height="${height}" class="line-graph">
				<defs>
					<linearGradient id="gradient-${color.replace('#', '')}" x1="0%" y1="0%" x2="0%" y2="100%">
						<stop offset="0%" style="stop-color:${color};stop-opacity:0.3" />
						<stop offset="100%" style="stop-color:${color};stop-opacity:0.1" />
					</linearGradient>
				</defs>
				<polyline
					fill="none"
					stroke="${color}"
					stroke-width="2"
					points="${points}"
				/>
				<polygon
					fill="url(#gradient-${color.replace('#', '')})"
					points="${points} ${width - padding},${height - padding} ${padding},${height - padding}"
				/>
				${data.map((d, i) => {
					const x = padding + (i / (data.length - 1)) * innerWidth;
					const y = height - padding - ((d.value - minValue) / valueRange) * innerHeight;
					return `<circle cx="${x}" cy="${y}" r="3" fill="${color}" />`;
				}).join('')}
			</svg>
		`;
	}

	// Load data when component mounts
	onMount(() => {
		loadRepoInfo();
		loadReadme();
		loadChangelog();
	});
</script>

<div class="repo-overview">
	<div class="repo-overview__left-wrapper">
		<div class="relative overflow-hidden radius-ml">
			<div bind:this={leftPanel} class="repo-overview__left">
				<div class="left-content scrollbar">
					<!-- Repository Statistics -->
					<BranchesListGroup title="Repository Statistics">
						<BranchesCardTemplate
							selected={selectedItem === 'stats'}
							onclick={() => (selectedItem = 'stats')}
						>
							{#snippet content()}
								<div class="overview-card__header">
									<Icon name="timeline" />
									<span class="text-13 text-semibold">{project.title}</span>
								</div>
								{#if loadingStats}
									<div class="overview-card__loading">
										<Icon name="spinner" />
										<span class="text-12">Loading statistics...</span>
									</div>
								{:else}
									<div class="overview-card__stats">
										<div class="stat-item">
											<Icon name="commit" />
											<span class="text-12">{repoStats.totalCommits.toLocaleString()} commits</span>
										</div>
										<div class="stat-item">
											<Icon name="branches" />
											<span class="text-12">{repoStats.totalBranches} branches</span>
										</div>
										<div class="stat-item">
											<Icon name="profile" />
											<span class="text-12">{repoStats.totalContributors} contributors</span>
										</div>
									</div>
								{/if}
							{/snippet}

							{#snippet details()}
								{#if !loadingStats}
									<div class="overview-card__details">
										<span class="text-12">{repoStats.repoSize}</span>
										<span class="overview-card__divider">•</span>
										<span class="text-12">main: {repoStats.mainBranch}</span>
									</div>
								{/if}
							{/snippet}
						</BranchesCardTemplate>
					</BranchesListGroup>

					<!-- Remote Repositories -->
					<BranchesListGroup title="Remote Repositories">
						{#if loadingRemotes}
							<BranchesCardTemplate>
								{#snippet content()}
									<div class="overview-card__loading">
										<Icon name="spinner" />
										<span class="text-12">Loading remotes...</span>
									</div>
								{/snippet}
								{#snippet details()}
									<span class="text-12">Please wait...</span>
								{/snippet}
							</BranchesCardTemplate>
						{:else if remotes.length > 0}
							{#each remotes as remote}
								<BranchesCardTemplate
									selected={selectedItem === 'remotes'}
									onclick={() => (selectedItem = 'remotes')}
								>
									{#snippet content()}
										<div class="overview-card__header">
											<Icon name="git" />
											<span class="text-13 text-semibold">{remote.name}</span>
										</div>
										<p class="text-12 overview-card__subtitle">
											{getRemoteDisplayName(remote)}
										</p>
									{/snippet}
									{#snippet details()}
										<span class="text-12">Remote</span>
									{/snippet}
								</BranchesCardTemplate>
							{/each}
						{:else}
							<BranchesCardTemplate>
								{#snippet content()}
									<div class="overview-card__header">
										<Icon name="info" />
										<span class="text-13">No Remote Repositories</span>
									</div>
									<p class="text-12 overview-card__subtitle">
										This repository doesn't have any remote repositories configured.
									</p>
								{/snippet}
								{#snippet details()}
									<span class="text-12">Not configured</span>
								{/snippet}
							</BranchesCardTemplate>
						{/if}
					</BranchesListGroup>

					<!-- README -->
					<BranchesListGroup title="README">
						<BranchesCardTemplate
							selected={selectedItem === 'readme'}
							onclick={() => (selectedItem = 'readme')}
						>
							{#snippet content()}
								{#if loadingReadme}
									<div class="overview-card__loading">
										<Icon name="spinner" />
										<span class="text-12">Loading README...</span>
									</div>
								{:else}
									<div class="overview-card__header">
										<Icon name="docs" />
										<span class="text-13 text-semibold">
											{readmeExists ? 'README.md' : 'No README'}
										</span>
									</div>
									<p class="text-12 overview-card__subtitle">
										{readmeExists
											? 'Click to view and edit repository documentation'
											: 'Create a README to provide information about your repository'}
									</p>
								{/if}
							{/snippet}

							{#snippet details()}
								{#if !loadingReadme}
									<div class="overview-card__readme-status">
										{#if readmeExists}
											<Icon name="tick" />
											<span class="text-12">Available</span>
										{:else}
											<Icon name="plus" />
											<span class="text-12">Create</span>
										{/if}
									</div>
								{/if}
							{/snippet}
						</BranchesCardTemplate>
					</BranchesListGroup>

					<!-- CHANGELOG -->
					<BranchesListGroup title="CHANGELOG">
						<BranchesCardTemplate
							selected={selectedItem === 'changelog'}
							onclick={() => (selectedItem = 'changelog')}
						>
							{#snippet content()}
								{#if loadingChangelog}
									<div class="overview-card__loading">
										<Icon name="spinner" />
										<span class="text-12">Loading CHANGELOG...</span>
									</div>
								{:else}
									<div class="overview-card__header">
										<Icon name="timeline" />
										<span class="text-13 text-semibold">
											{changelogExists ? 'CHANGELOG.md' : 'No CHANGELOG'}
										</span>
									</div>
									<p class="text-12 overview-card__subtitle">
										{changelogExists
											? 'Track project changes and version history'
											: 'Create a CHANGELOG to document project changes'}
									</p>
								{/if}
							{/snippet}

							{#snippet details()}
								{#if !loadingChangelog}
									<div class="overview-card__readme-status">
										{#if changelogExists}
											<Icon name="tick" />
											<span class="text-12">Available</span>
										{:else}
											<Icon name="plus" />
											<span class="text-12">Create</span>
										{/if}
									</div>
								{/if}
							{/snippet}
						</BranchesCardTemplate>
					</BranchesListGroup>
				</div>
			</div>
		</div>
		<Resizer
			viewport={leftPanel}
			direction="right"
			minWidth={14}
			borderRadius="ml"
			persistId="resizer-repoOverviewWidth"
			defaultValue={sidebarWidth.current}
		/>
	</div>

	<div class="repo-overview__right">
		<div class="right-wrapper scrollbar dotted-pattern" bind:this={rightPanel}>
			<div class="content-column">
				{#if selectedItem === 'stats'}
					<!-- Project File Browser -->
					<div class="content-header">
						<h2 class="text-18 text-semibold">Project Files</h2>
						<p class="text-12 text-body">Browse and preview files in {project.title}</p>
					</div>

					{#if loadingFiles}
						<div class="content-loading">
							<FullviewLoading />
						</div>
					{:else}
						<div class="file-browser">
							<div class="file-browser-content">
								<!-- File Tree -->
								<div class="file-tree">
									<div class="file-tree-header">
										<h3 class="text-13 text-semibold">File Explorer</h3>
									</div>
									<div class="file-tree-list">
										{#each projectFiles as node}
											{@render fileTreeNode(node, 0)}
										{/each}
									</div>
								</div>

								<!-- File Preview -->
								{#if selectedFilePath}
									<div class="file-preview">
										<div class="file-preview-header">
											<div class="file-preview-title">
												<FileIcon fileName={selectedFilePath} />
												<span class="text-13 text-semibold">{selectedFilePath.split('/').pop()}</span>
											</div>
											<Button 
												kind="ghost" 
												size="button" 
												icon="cross-small" 
												onclick={() => { selectedFilePath = null; filePreviewContent = ''; }}
											>
												Close
											</Button>
										</div>
										<div class="file-preview-content">
											{#if loadingFilePreview}
												<div class="file-preview-loading">
													<Icon name="spinner" />
													<span class="text-12 text-body">Loading...</span>
												</div>
											{:else}
												<pre class="file-content">{filePreviewContent}</pre>
											{/if}
										</div>
									</div>
								{:else}
									<div class="file-preview-placeholder">
										<div class="placeholder-content">
											<Icon name="doc" />
											<h4 class="text-15 text-semibold">Select a file to preview</h4>
											<p class="text-12 text-body">Click on any file in the explorer to view its contents</p>
										</div>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				{:else if selectedItem === 'remotes'}
					<!-- Remote Repositories Detail View -->
					<div class="content-header">
						<h2 class="text-18 text-semibold">Remote Repositories</h2>
						<p class="text-12 text-body">Connected remote repositories</p>
					</div>

					{#if loadingRemotes}
						<div class="content-loading">
							<FullviewLoading />
						</div>
					{:else if remotes.length > 0}
						<div class="remotes-detail scrollbar">
							{#each remotes as remote}
								<div class="remote-detail-card">
									<div class="remote-header">
										<Icon name="git" />
										<h3 class="text-15 text-semibold">{remote.name}</h3>
									</div>
									<p class="text-13 remote-url">{remote.url}</p>
									<div class="remote-actions">
										<Button
											kind="outline"
											icon="open-link"
											onclick={() => window.open(remote.url, '_blank')}
										>
											Open Repository
										</Button>
									</div>
								</div>
							{/each}
						</div>
					{:else}
						<div class="empty-state">
							<Icon name="info" />
							<h3 class="text-15 text-semibold">No Remote Repositories</h3>
							<p class="text-12 text-body">
								This repository doesn't have any remote repositories configured.
							</p>
						</div>
					{/if}
				{:else if selectedItem === 'readme'}
					<!-- README Detail View -->
					<div class="content-header">
						<h2 class="text-18 text-semibold">README</h2>
						{#if editingReadme}
							<div class="header-actions">
								<Button kind="outline" onclick={cancelEditingReadme} disabled={savingReadme}>
									Cancel
								</Button>
								<Button
									style="pop"
									onclick={saveReadme}
									loading={savingReadme}
									disabled={!hasReadmeChanges || savingReadme}
								>
									Save Changes
								</Button>
							</div>
						{:else if readmeExists}
							<Button
								kind="outline"
								icon="settings"
								onclick={startEditingReadme}
								disabled={savingReadme}
							>
								Edit README
							</Button>
						{/if}
					</div>

					{#if loadingReadme}
						<div class="content-loading">
							<FullviewLoading />
						</div>
					{:else if editingReadme}
						<div class="readme-editor-detail">
							<textarea
								class="scrollbar"
								bind:value={editedReadmeContent}
								placeholder="Enter your README content here... (Markdown supported)"
								disabled={savingReadme}
							></textarea>
							<div class="editor-help">
								<Icon name="info" />
								<span class="text-11 text-body">Supports Markdown formatting</span>
							</div>
						</div>
					{:else if readmeExists && readmeContent.trim()}
						<div class="readme-content-detail scrollbar">
							<Markdown content={readmeContent} />
						</div>
					{:else}
						<div class="empty-state">
							<Icon name="docs" />
							<h3 class="text-15 text-semibold">No README File</h3>
							<p class="text-12 text-body">
								Create a README to provide information about your repository for other developers.
							</p>
							<Button style="pop" icon="plus" onclick={startEditingReadme}>Create README</Button>
						</div>
					{/if}
				{:else if selectedItem === 'changelog'}
					<!-- CHANGELOG Detail View -->
					<div class="content-header">
						<h2 class="text-18 text-semibold">CHANGELOG</h2>
						{#if editingChangelog}
							<div class="header-actions">
								<Button kind="outline" onclick={cancelEditingChangelog} disabled={savingChangelog}>
									Cancel
								</Button>
								<Button
									style="pop"
									onclick={saveChangelog}
									loading={savingChangelog}
									disabled={!hasChangelogChanges || savingChangelog}
								>
									Save Changes
								</Button>
							</div>
						{:else if changelogExists}
							<div class="header-actions">
								<Button
									kind="outline"
									icon="settings"
									onclick={startEditingChangelog}
									disabled={savingChangelog}
								>
									Edit CHANGELOG
								</Button>
								<Button
									style="pop"
									icon="ai"
									onclick={() => {
										if (!editingChangelog) {
											startEditingChangelog();
										}
										generateChangelogEntry();
									}}
									loading={generatingChangelogEntry}
									disabled={savingChangelog || generatingChangelogEntry}
								>
									Generate Entry
								</Button>
							</div>
						{/if}
					</div>

					{#if loadingChangelog}
						<div class="content-loading">
							<FullviewLoading />
						</div>
					{:else if editingChangelog}
						<div class="readme-editor-detail">
							<div class="changelog-editor-actions">
								<Button
									kind="outline"
									icon="ai"
									onclick={generateChangelogEntry}
									loading={generatingChangelogEntry}
									disabled={savingChangelog}
								>
									Generate AI Entry
								</Button>
							</div>
							<textarea
								class="scrollbar"
								bind:value={editedChangelogContent}
								placeholder="Enter your CHANGELOG content here... (Markdown supported)"
								disabled={savingChangelog}
							></textarea>
							<div class="editor-help">
								<Icon name="info" />
								<span class="text-11 text-body">Use AI to generate changelog entries or write manually. Supports Markdown formatting.</span>
							</div>
						</div>
					{:else if changelogExists && changelogContent.trim()}
						<div class="readme-content-detail scrollbar">
							<Markdown content={changelogContent} />
						</div>
					{:else}
						<div class="empty-state">
							<Icon name="timeline" />
							<h3 class="text-15 text-semibold">No CHANGELOG File</h3>
							<p class="text-12 text-body">
								Create a CHANGELOG to track project changes and version history for your users and contributors.
							</p>
							<Button style="pop" icon="plus" onclick={startEditingChangelog}>Create CHANGELOG</Button>
						</div>
					{/if}
				{:else}
					<!-- Default/Welcome View -->
					<div class="content-header">
						<h2 class="text-18 text-semibold">Repository Overview</h2>
						<p class="text-12 text-body">Select an item from the sidebar to view details</p>
					</div>

					<div class="welcome-state">
						<Icon name="timeline" />
						<h3 class="text-15 text-semibold">Welcome to {project.title}</h3>
						<p class="text-12 text-body">
							Use the sidebar to explore repository statistics, remotes, and
							documentation.
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

{#snippet fileTreeNode(node: ProjectFileNode, depth: number)}
	<div class="file-tree-item" style="padding-left: {depth * 16}px;">
		{#if node.isDirectory}
			<button 
				class="file-tree-folder"
				class:expanded={node.isExpanded}
				onclick={() => toggleFileFolder(node)}
			>
				<Icon name={node.isExpanded ? 'chevron-down' : 'chevron-right'} />
				<span class="text-12">{node.name}</span>
				<Icon name="chevron-right" />
			</button>
			{#if node.isExpanded && node.children}
				{#each node.children as child}
					{@render fileTreeNode(child, depth + 1)}
				{/each}
			{/if}
		{:else}
			<button 
				class="file-tree-file"
				class:selected={selectedFilePath === node.path}
				onclick={() => selectFile(node.path)}
			>
				<FileIcon fileName={node.name} />
				<span class="text-12">{node.name}</span>
				{#if node.size}
					<span class="file-size text-11 text-body">
						{(node.size / 1024).toFixed(1)}KB
					</span>
				{/if}
			</button>
		{/if}
	</div>
{/snippet}

<style lang="postcss">
	.repo-overview {
		display: flex;
		position: relative;
		width: 100%;
		height: 100%;
		gap: 8px;
	}

	.repo-overview__left-wrapper {
		display: flex;
		position: relative;
		min-width: 200px;
		max-width: 600px;
	}

	.repo-overview__left,
	.repo-overview__right {
		position: relative;
		flex: 1;
		height: 100%;
		overflow: hidden;
		border: 1px solid var(--clr-border-2);
		border-radius: var(--radius-ml);
	}

	.repo-overview__right {
		flex: 1;
		min-width: 0;
	}

	.repo-overview__left {
		display: flex;
		flex-direction: column;
	}

	.left-content {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
		padding: var(--size-12);
		overflow-y: auto;
		gap: var(--size-12);
	}

	.right-wrapper {
		display: flex;
		position: relative;
		height: 100%;
		margin-left: -1px;
		overflow: hidden;
		overflow-x: hidden;
		overflow-y: auto;
		word-wrap: break-word;
		width: 100%;
		min-width: 0;
		overflow-wrap: break-word;
	}

	.content-column {
		display: flex;
		position: relative;
		flex-grow: 1;
		flex-shrink: 1;
		flex-direction: column;
		min-width: 0;
		max-width: 100%;
		max-height: calc(100% + 1px);
		overflow: hidden;
		word-wrap: break-word;
		width: 100%;
		overflow-wrap: break-word;
	}

	/* Overview Card Styles */
	.overview-card__header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.overview-card__subtitle {
		margin-top: 4px;
		color: var(--clr-text-2);
	}

	.overview-card__loading {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--clr-text-2);
	}

	.overview-card__stats {
		display: flex;
		flex-direction: column;
		margin-top: 8px;
		gap: 6px;
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--clr-text-2);
	}

	.overview-card__details {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--clr-text-2);
	}

	.overview-card__divider {
		color: var(--clr-text-3);
	}

	.overview-card__readme-status {
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--clr-text-2);
	}

	/* Content Area Styles */
	.content-header {
		display: flex;
		flex-wrap: wrap;
		align-items: start;
		justify-content: space-between;
		min-width: 0;
		padding: 16px;
		gap: 16px;
		border-bottom: 1px solid var(--clr-border-2);
		background-color: var(--clr-bg-1);
	}

	.content-header h2 {
		flex: 1;
		min-width: 0;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.content-header p {
		flex-basis: 100%;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.header-actions {
		display: flex;
		flex-shrink: 0;
		gap: 8px;
	}

	.changelog-editor-actions {
		display: flex;
		justify-content: flex-start;
		margin-bottom: 12px;
		gap: 8px;
	}

	.content-loading {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: center;
		padding: 40px;
	}

	.remotes-detail {
		display: flex;
		flex: 1;
		flex-direction: column;
		padding: 16px;
		overflow-y: auto;
		gap: 16px;
	}

	.remote-detail-card {
		display: flex;
		flex-direction: column;
		padding: 20px;
		gap: 12px;
		border: 1px solid var(--clr-border-2);
		border-radius: var(--radius-m);
		background: var(--clr-bg-2);
	}

	.remote-header {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.remote-url {
		color: var(--clr-text-2);
		font-family: var(--font-mono);
		word-break: break-all;
	}

	.remote-actions {
		display: flex;
		gap: 8px;
	}

	.readme-editor-detail {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-width: 0;
		max-width: 100%;
		padding: 16px;
		overflow: hidden;
		gap: 16px;
	}

	.readme-editor-detail textarea {
		flex: 1;
		width: 100%;
		min-height: 300px;
		padding: 16px;
		border: 1px solid var(--clr-border-2);
		border-radius: var(--radius-m);
		background: var(--clr-bg-2);
		color: var(--clr-text-1);
		font-size: 13px;
		line-height: 1.5;
		font-family: var(--font-mono);
		resize: none;
		transition: border-color 0.2s ease;
		word-wrap: break-word;
		box-sizing: border-box;
		min-width: 0;
		max-width: 100%;
		overflow-x: hidden;
		overflow-y: auto;
		white-space: pre-wrap;
		overflow-wrap: break-word;
	}

	.readme-editor-detail textarea:focus {
		border-color: var(--clr-theme-pop-bg);
		outline: none;
	}

	.readme-editor-detail textarea:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.editor-help {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--clr-text-2);
	}

	.readme-content-detail {
		flex: 1;
		padding: 20px;
		overflow-x: hidden;
		overflow-y: auto;
		background: var(--clr-bg-1);
		word-wrap: break-word;
		contain: layout style;
		width: 100%;
		min-width: 0;
		max-width: 100%;
		overflow-wrap: break-word;
	}

	/* Fix markdown content overflow - more comprehensive */
	.readme-content-detail :global(*) {
		max-width: 100% !important;
		word-wrap: break-word !important;
		box-sizing: border-box !important;
		overflow-wrap: break-word !important;
	}

	.readme-content-detail :global(pre) {
		max-width: 100% !important;
		overflow-x: auto !important;
		word-wrap: normal !important;
		box-sizing: border-box !important;
		width: auto !important;
		white-space: pre-wrap !important;
	}

	.readme-content-detail :global(code) {
		word-wrap: break-word !important;
		width: auto !important;
		max-width: 100% !important;
		white-space: pre-wrap !important;
		overflow-wrap: break-word !important;
	}

	.readme-content-detail :global(p),
	.readme-content-detail :global(div),
	.readme-content-detail :global(span),
	.readme-content-detail :global(h1),
	.readme-content-detail :global(h2),
	.readme-content-detail :global(h3),
	.readme-content-detail :global(h4),
	.readme-content-detail :global(h5),
	.readme-content-detail :global(h6) {
		word-wrap: break-word !important;
		width: auto !important;
		max-width: 100% !important;
		overflow-wrap: break-word !important;
	}

	.readme-content-detail :global(img) {
		display: block !important;
		width: auto !important;
		max-width: 100% !important;
		height: auto !important;
	}

	.readme-content-detail :global(table) {
		box-sizing: border-box !important;
		display: table !important;
		width: 100% !important;
		max-width: 100% !important;
		overflow-x: auto !important;
		table-layout: fixed !important;
	}

	.readme-content-detail :global(td),
	.readme-content-detail :global(th) {
		word-wrap: break-word !important;
		max-width: 0 !important;
		overflow-wrap: break-word !important;
	}

	.readme-content-detail :global(a) {
		word-wrap: break-word !important;
		max-width: 100% !important;
		word-break: break-all !important;
		overflow-wrap: break-word !important;
	}

	.readme-content-detail :global(blockquote) {
		max-width: 100% !important;
		word-wrap: break-word !important;
		box-sizing: border-box !important;
		overflow-wrap: break-word !important;
	}

	.readme-content-detail :global(ul),
	.readme-content-detail :global(ol) {
		box-sizing: border-box !important;
		max-width: 100% !important;
		padding-right: 20px !important;
	}

	.readme-content-detail :global(li) {
		word-wrap: break-word !important;
		max-width: 100% !important;
		overflow-wrap: break-word !important;
	}

	.empty-state,
	.welcome-state {
		display: flex;
		flex: 1;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px;
		gap: 12px;
		color: var(--clr-text-2);
		text-align: center;
	}

	.empty-state h3,
	.welcome-state h3 {
		margin: 0;
		color: var(--clr-text-1);
	}

	.empty-state p,
	.welcome-state p {
		max-width: 300px;
		margin: 0;
		line-height: 1.4;
	}

	/* File Browser Styles */
	.file-browser {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.file-browser-content {
		display: flex;
		height: 100%;
		gap: 12px;
		min-height: 0;
	}

	.file-tree {
		flex: 0 0 300px;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--clr-border-2);
		border-radius: 6px;
		background: var(--clr-bg-1);
		overflow: hidden;
	}

	.file-tree-header {
		padding: 12px;
		background: var(--clr-bg-2);
		border-bottom: 1px solid var(--clr-border-2);
	}

	.file-tree-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px 0;
	}

	.file-tree-item {
		display: block;
	}

	.file-tree-folder,
	.file-tree-file {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.15s ease;
		color: var(--clr-text-1);
	}

	.file-tree-folder:hover,
	.file-tree-file:hover {
		background: var(--clr-bg-2);
	}

	.file-tree-file.selected {
		background: var(--clr-accent-element);
		color: var(--clr-accent-text);
	}

	.file-tree-folder :global(.icon:last-child) {
		margin-left: auto;
		transition: transform 0.15s ease;
		font-size: 12px;
	}

	.file-tree-folder.expanded :global(.icon:last-child) {
		transform: rotate(90deg);
	}

	.file-size {
		margin-left: auto;
		opacity: 0.7;
	}

	.file-preview {
		flex: 1;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--clr-border-2);
		border-radius: 6px;
		background: var(--clr-bg-1);
		overflow: hidden;
		min-width: 0;
	}

	.file-preview-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px;
		background: var(--clr-bg-2);
		border-bottom: 1px solid var(--clr-border-2);
	}

	.file-preview-title {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.file-preview-content {
		flex: 1;
		overflow: auto;
		background: var(--clr-bg-1);
	}

	.file-preview-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 40px;
		color: var(--clr-text-2);
	}

	.file-content {
		padding: 16px;
		margin: 0;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.5;
		color: var(--clr-text-1);
		background: var(--clr-bg-1);
		white-space: pre-wrap;
		word-break: break-word;
		overflow-wrap: break-word;
	}

	.file-preview-placeholder {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--clr-border-2);
		border-radius: 6px;
		background: var(--clr-bg-1);
	}

	.placeholder-content {
		text-align: center;
		color: var(--clr-text-2);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}

	.placeholder-content :global(.icon) {
		font-size: 24px;
		opacity: 0.5;
	}
</style>
