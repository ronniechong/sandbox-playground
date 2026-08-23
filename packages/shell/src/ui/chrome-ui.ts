import type { Registry, RegistryEntry } from '../registry/types.ts';
import {
  collectTags,
  filterEntries,
  sortEntries,
  type SortDirection,
  type SortKey,
} from '../registry/filter.ts';
import { createFocusTrap } from '../state/focus-trap.ts';
import type { Theme } from '../state/theme-state.ts';
import { el } from '../dom.ts';
import { buildBrandMark } from './brand.ts';
import { fullLabel, relativeLabel } from './date-format.ts';
import {
  buildChevronUpIcon,
  buildChromeToggleIcon,
  buildHamburgerIcon,
  buildHomeIcon,
  buildMoonIcon,
  buildSunIcon,
} from './icons.ts';

export interface ChromeUICallbacks {
  onHomeClick(): void;
  onToggleChrome(): void;
  onToggleTheme(): void;
  onSelect(slug: string): void;
}

interface GridState {
  query: string;
  tags: string[];
  showArchived: boolean;
  sortKey: SortKey;
  sortDirection: SortDirection;
}

function emptyGridState(): GridState {
  return { query: '', tags: [], showArchived: false, sortKey: 'date', sortDirection: 'desc' };
}

const SORT_OPTIONS: Array<{
  value: string;
  key: SortKey;
  direction: SortDirection;
  label: string;
}> = [
  { value: 'title-asc', key: 'title', direction: 'asc', label: 'Title (A–Z)' },
  { value: 'title-desc', key: 'title', direction: 'desc', label: 'Title (Z–A)' },
  { value: 'date-desc', key: 'date', direction: 'desc', label: 'Newest first' },
  { value: 'date-asc', key: 'date', direction: 'asc', label: 'Oldest first' },
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

const DRAWER_CLOSE_MS = 220;

/**
 * Builds and owns the shell's own DOM chrome: header, home grid, drawer,
 * chromeless restore affordance. Hand-namespaced `.shell-*` CSS only —
 * this is global page chrome, not a per-experiment scoped bundle (see
 * packages/build-preset/src/shell.ts).
 */
export class ChromeUI {
  readonly wrapperEl: HTMLElement;
  readonly appContainer: HTMLElement;

  private readonly titleEl: HTMLElement;
  private readonly titleNameEl: HTMLElement;
  private readonly titlePlateEl: HTMLElement;
  private readonly titleDateEl: HTMLTimeElement;
  private readonly hamburgerBtn: HTMLButtonElement;
  private readonly themeBtn: HTMLButtonElement;
  private readonly chromeBtn: HTMLButtonElement;
  private readonly restoreBtn: HTMLButtonElement;
  private readonly drawerBackdrop: HTMLElement;
  private readonly drawerEl: HTMLElement;
  private readonly drawerSearch: HTMLInputElement;
  private readonly drawerList: HTMLElement;
  private readonly focusTrap: ReturnType<typeof createFocusTrap>;

  private callbacks: ChromeUICallbacks;
  private drawerOpen = false;
  private homeActive = false;
  private lastFocused: HTMLElement | null = null;
  private homeGridState = emptyGridState();
  private currentRegistry: Registry = [];
  private homeSearchInput: HTMLInputElement | null = null;
  private closeAnimationTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(root: HTMLElement, basePath: string, callbacks: ChromeUICallbacks) {
    this.callbacks = callbacks;
    root.textContent = '';

    this.titleNameEl = el('span', { className: 'shell-current-title-name' });
    this.titlePlateEl = el('span', { className: 'shell-plate' });
    this.titleDateEl = el('time', { className: 'shell-current-title-date' });
    this.titleEl = el(
      'span',
      { className: 'shell-current-title', hidden: true },
      el('span', { className: 'shell-current-title-sep', 'aria-hidden': 'true' }, '/'),
      this.titleNameEl,
      this.titlePlateEl,
      this.titleDateEl,
    );

    const homeLink = el(
      'a',
      {
        className: 'shell-home-link',
        href: basePath || '/',
        onclick: (event) => {
          event.preventDefault();
          this.callbacks.onHomeClick();
        },
      },
      buildBrandMark(),
      el('span', { className: 'shell-wordmark' }, 'Sandbox Playground'),
    );

    this.hamburgerBtn = el(
      'button',
      {
        type: 'button',
        className: 'shell-hamburger shell-iconbtn',
        'aria-expanded': 'false',
        'aria-label': 'Open experiment navigation',
        onclick: () => this.toggleDrawer(),
      },
      buildHamburgerIcon(),
    );

    this.themeBtn = el('button', {
      type: 'button',
      className: 'shell-theme-toggle shell-iconbtn',
      'aria-label': 'Toggle theme',
      onclick: () => this.callbacks.onToggleTheme(),
    });

    this.chromeBtn = el(
      'button',
      {
        type: 'button',
        className: 'shell-chrome-toggle shell-iconbtn',
        'aria-label': 'Hide chrome',
        onclick: () => this.callbacks.onToggleChrome(),
      },
      buildChromeToggleIcon(),
    );

    const header = el(
      'header',
      { className: 'shell-header' },
      this.hamburgerBtn,
      homeLink,
      this.titleEl,
      el('div', { className: 'shell-header-spacer' }),
      el('div', { className: 'shell-header-tools' }, this.themeBtn, this.chromeBtn),
    );

    this.appContainer = el('div', { className: 'shell-app' });

    this.drawerBackdrop = el('div', {
      className: 'shell-drawer-backdrop',
      hidden: true,
      onclick: () => this.closeDrawer(),
    });

    this.drawerSearch = el('input', {
      type: 'search',
      className: 'shell-drawer-search',
      placeholder: 'Search experiments…',
      'aria-label': 'Search experiments',
      oninput: () => this.renderDrawerList(),
    });

    this.drawerList = el('div', { className: 'shell-drawer-list' });

    this.drawerEl = el(
      'aside',
      {
        className: 'shell-drawer',
        role: 'dialog',
        'aria-label': 'Experiment navigation',
        hidden: true,
      },
      el(
        'div',
        { className: 'shell-drawer-head' },
        buildBrandMark(),
        el('span', { className: 'shell-drawer-heading' }, 'Experiments'),
      ),
      el(
        'a',
        {
          className: 'shell-drawer-home-link',
          href: basePath || '/',
          onclick: (event) => {
            event.preventDefault();
            this.closeDrawer();
            this.callbacks.onHomeClick();
          },
        },
        buildHomeIcon(),
        'Home',
      ),
      this.drawerSearch,
      this.drawerList,
    );
    this.focusTrap = createFocusTrap(this.drawerEl);
    this.drawerEl.addEventListener('keydown', (event) => this.focusTrap.handleKeydown(event));

    this.restoreBtn = el(
      'button',
      {
        type: 'button',
        className: 'shell-restore-chrome',
        hidden: true,
        onclick: () => this.callbacks.onToggleChrome(),
      },
      buildChevronUpIcon(),
      'Show chrome',
    );

    this.wrapperEl = el(
      'div',
      { className: 'shell-wrapper' },
      header,
      this.appContainer,
      this.drawerBackdrop,
      this.drawerEl,
      this.restoreBtn,
    );
    root.appendChild(this.wrapperEl);

    document.addEventListener('keydown', (event) => this.handleGlobalKeydown(event));
  }

  setExperimentTitle(entry: RegistryEntry | null): void {
    this.homeActive = entry === null;
    this.titleEl.hidden = entry === null;
    if (!entry) return;
    this.titleNameEl.textContent = entry.title;
    this.titlePlateEl.textContent = `v${entry.version}`;
    this.titleDateEl.textContent = relativeLabel(entry.lastUpdated);
    this.titleDateEl.dateTime = entry.lastUpdated;
    this.titleDateEl.title = `Built ${fullLabel(entry.lastUpdated)}`;
  }

  setChromeHidden(hidden: boolean): void {
    this.wrapperEl.classList.toggle('shell-chromeless', hidden);
    this.restoreBtn.hidden = !hidden;
    this.chromeBtn.setAttribute('aria-label', hidden ? 'Show chrome' : 'Hide chrome');
  }

  setTheme(theme: Theme): void {
    this.wrapperEl.setAttribute('data-shell-theme', theme);
    this.themeBtn.replaceChildren(theme === 'dark' ? buildSunIcon() : buildMoonIcon());
  }

  showLoading(): void {
    this.appContainer.textContent = '';
    this.appContainer.appendChild(
      el(
        'div',
        { className: 'shell-loading', role: 'status' },
        el(
          'div',
          { className: 'shell-loading-spinner' },
          el('span', { className: 'shell-loading-dot' }),
          el('span', { className: 'shell-loading-dot' }),
          el('span', { className: 'shell-loading-dot' }),
        ),
        el('span', { className: 'shell-loading-label' }, 'Loading…'),
      ),
    );
  }

  renderHome(registry: Registry): void {
    this.currentRegistry = registry;
    this.homeGridState = emptyGridState();
    this.setExperimentTitle(null);
    this.appContainer.textContent = '';

    const search = el('input', {
      type: 'search',
      className: 'shell-home-search',
      placeholder: 'Search experiments…',
      'aria-label': 'Search experiments',
    });
    this.homeSearchInput = search;

    const archivedCheckbox = el('input', { type: 'checkbox' });
    const archivedToggle = el(
      'label',
      { className: 'shell-archived-toggle' },
      archivedCheckbox,
      ' Show archived',
    );

    const sortSelect = el(
      'select',
      { className: 'shell-sort-select', 'aria-label': 'Sort experiments' },
      ...SORT_OPTIONS.map((option) => el('option', { value: option.value }, option.label)),
    );
    sortSelect.value = `${this.homeGridState.sortKey}-${this.homeGridState.sortDirection}`;

    const grid = el('div', { className: 'shell-grid' });

    const renderGrid = () => {
      grid.textContent = '';
      const filtered = filterEntries(this.currentRegistry, this.homeGridState);
      const results = sortEntries(filtered, {
        key: this.homeGridState.sortKey,
        direction: this.homeGridState.sortDirection,
      });
      for (const entry of results) {
        grid.appendChild(this.buildCard(entry));
      }
      if (results.length === 0) {
        grid.appendChild(el('p', { className: 'shell-grid-empty' }, 'No experiments match.'));
      }
    };

    const tagBar = el(
      'div',
      { className: 'shell-tag-bar' },
      ...collectTags(registry).map((tag) => {
        const tagBtn: HTMLButtonElement = el(
          'button',
          {
            type: 'button',
            className: 'shell-tag-filter',
            onclick: () => {
              const idx = this.homeGridState.tags.indexOf(tag);
              if (idx === -1) this.homeGridState.tags.push(tag);
              else this.homeGridState.tags.splice(idx, 1);
              tagBtn.classList.toggle('is-active', idx === -1);
              renderGrid();
            },
          },
          tag,
        );
        return tagBtn;
      }),
    );

    search.addEventListener('input', () => {
      this.homeGridState.query = search.value;
      renderGrid();
    });
    archivedCheckbox.addEventListener('change', () => {
      this.homeGridState.showArchived = archivedCheckbox.checked;
      renderGrid();
    });
    sortSelect.addEventListener('change', () => {
      const chosen = SORT_OPTIONS.find((option) => option.value === sortSelect.value);
      if (!chosen) return;
      this.homeGridState.sortKey = chosen.key;
      this.homeGridState.sortDirection = chosen.direction;
      renderGrid();
    });

    this.appContainer.appendChild(
      el(
        'div',
        { className: 'shell-home' },
        el('div', { className: 'shell-home-controls' }, search, sortSelect, archivedToggle),
        tagBar,
        grid,
      ),
    );
    renderGrid();
  }

  private buildCard(entry: RegistryEntry): HTMLElement {
    const foot = el(
      'div',
      { className: 'shell-card-foot' },
      entry.tags.length > 0
        ? el(
            'div',
            { className: 'shell-card-tags' },
            ...entry.tags.map((tag) => el('span', { className: 'shell-card-tag' }, `#${tag}`)),
          )
        : null,
      el('span', { className: 'shell-plate' }, `v${entry.version}`),
    );

    const meta = el(
      'time',
      {
        className: 'shell-card-meta',
        datetime: entry.lastUpdated,
        title: `Built ${fullLabel(entry.lastUpdated)}`,
      },
      relativeLabel(entry.lastUpdated),
    );

    return el(
      'button',
      {
        type: 'button',
        className: 'shell-card',
        onclick: () => this.callbacks.onSelect(entry.slug),
      },
      el(
        'div',
        { className: 'shell-card-top' },
        el('span', { className: `shell-dot shell-dot--${entry.status}` }),
        el('h3', { className: 'shell-card-title' }, entry.title),
      ),
      entry.description
        ? el('p', { className: 'shell-card-description' }, entry.description)
        : null,
      foot,
      meta,
    );
  }

  setRegistry(registry: Registry): void {
    this.currentRegistry = registry;
    if (this.drawerOpen) this.renderDrawerList();
  }

  private renderDrawerList(): void {
    this.drawerList.textContent = '';
    const results = filterEntries(this.currentRegistry, {
      query: this.drawerSearch.value,
      tags: [],
      showArchived: false,
    });
    for (const entry of results) {
      const item = el(
        'button',
        {
          type: 'button',
          className: 'shell-drawer-item',
          onclick: () => {
            this.closeDrawer();
            this.callbacks.onSelect(entry.slug);
          },
        },
        el('span', { className: `shell-dot shell-dot--${entry.status}` }),
        el(
          'span',
          { className: 'shell-drawer-item-meta' },
          el('span', { className: 'shell-drawer-item-name' }, entry.title),
          el(
            'time',
            { className: 'shell-drawer-item-date', datetime: entry.lastUpdated },
            relativeLabel(entry.lastUpdated),
          ),
        ),
        el('span', { className: 'shell-plate' }, `v${entry.version}`),
      );
      this.drawerList.appendChild(item);
    }
    if (results.length === 0) {
      this.drawerList.appendChild(
        el('p', { className: 'shell-drawer-empty' }, 'No experiments match.'),
      );
    }
  }

  toggleDrawer(): void {
    if (this.drawerOpen) this.closeDrawer();
    else this.openDrawer();
  }

  openDrawer(): void {
    if (this.drawerOpen) return;
    this.drawerOpen = true;
    clearTimeout(this.closeAnimationTimer);
    this.lastFocused = document.activeElement as HTMLElement | null;
    this.drawerSearch.value = '';
    this.renderDrawerList();
    this.drawerBackdrop.hidden = false;
    this.drawerEl.hidden = false;
    // Force the closed transform to apply before flipping the open class,
    // so the browser has something to transition from.
    this.drawerEl.getBoundingClientRect();
    this.drawerEl.classList.add('is-open');
    this.drawerBackdrop.classList.add('is-open');
    this.hamburgerBtn.setAttribute('aria-expanded', 'true');
    this.drawerSearch.focus();
  }

  closeDrawer(): void {
    if (!this.drawerOpen) return;
    this.drawerOpen = false;
    this.drawerEl.classList.remove('is-open');
    this.drawerBackdrop.classList.remove('is-open');
    this.hamburgerBtn.setAttribute('aria-expanded', 'false');
    (this.lastFocused ?? this.hamburgerBtn).focus();
    this.lastFocused = null;
    // Keeps the drawer rendered (not display:none) for the slide-out
    // transition, then removes it from the a11y tree once it finishes.
    clearTimeout(this.closeAnimationTimer);
    this.closeAnimationTimer = setTimeout(
      () => {
        this.drawerBackdrop.hidden = true;
        this.drawerEl.hidden = true;
      },
      prefersReducedMotion() ? 0 : DRAWER_CLOSE_MS,
    );
  }

  isDrawerOpen(): boolean {
    return this.drawerOpen;
  }

  private handleGlobalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.drawerOpen) {
        this.closeDrawer();
        return;
      }
      if (this.wrapperEl.classList.contains('shell-chromeless')) {
        this.callbacks.onToggleChrome();
      }
      return;
    }

    if (event.key === '/') {
      if (this.drawerOpen) {
        event.preventDefault();
        this.drawerSearch.focus();
        return;
      }
      if (this.homeActive && this.homeSearchInput) {
        event.preventDefault();
        this.homeSearchInput.focus();
      }
    }
  }
}
