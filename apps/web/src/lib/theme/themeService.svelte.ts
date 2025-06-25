import { persisted } from '@gitbutler/shared/persisted';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark' | 'system';

/**
 * Theme store that persists the user's theme preference in localStorage
 */
export const themeStore = persisted<Theme>('system', 'theme');

let systemTheme: string | null;
let selectedTheme: string | undefined;

/**
 * Get the system theme preference
 */
function getSystemTheme(): 'light' | 'dark' {
	if (!browser) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Update DOM with theme classes - matches desktop app implementation
 */
function updateDom() {
	if (!browser) return;
	
	const docEl = document.documentElement;
	if (
		selectedTheme === 'dark' ||
		(selectedTheme === 'system' && systemTheme === 'dark') ||
		(selectedTheme === undefined && systemTheme === 'dark')
	) {
		docEl.classList.remove('light');
		docEl.classList.add('dark');
		docEl.style.colorScheme = 'dark';
	} else if (
		selectedTheme === 'light' ||
		(selectedTheme === 'system' && systemTheme === 'light') ||
		(selectedTheme === undefined && systemTheme === 'light')
	) {
		docEl.classList.remove('dark');
		docEl.classList.add('light');
		docEl.style.colorScheme = 'light';
	}
}

/**
 * Initialize theme system - matches desktop app implementation
 */
export function initTheme() {
	if (!browser) return;

	// Get initial system theme
	systemTheme = getSystemTheme();
	updateDom();

	// Watch for system theme changes
	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
	mediaQuery.addEventListener('change', (e) => {
		systemTheme = e.matches ? 'dark' : 'light';
		updateDom();
	});

	// Subscribe to theme changes and apply them
	themeStore.subscribe((theme) => {
		selectedTheme = theme;
		updateDom();
	});
}

/**
 * Set the theme preference
 */
export function setTheme(theme: Theme) {
	themeStore.set(theme);
}
