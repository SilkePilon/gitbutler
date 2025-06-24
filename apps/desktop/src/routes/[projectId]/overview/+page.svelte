<script lang="ts">
	import { page } from '$app/state';
	import RepoOverviewView from '$components/RepoOverviewView.svelte';

	const projectId = $derived(page.params.projectId!);
</script>

<RepoOverviewView {projectId} />
