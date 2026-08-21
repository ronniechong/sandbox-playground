import type { Registry, RegistryEntry } from './types.ts';
import { collectTags, filterEntries } from './filter.ts';
import { createFocusTrap } from './focus-trap.ts';
import type { Theme } from './theme-state.ts';

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
}

function emptyGridState(): GridState {
  return { query: '', tags: [], showArchived: false };
}

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

  constructor(root: HTMLElement, basePath: string, callbacks: ChromeUICallbacks) {
    this.callbacks = callbacks;
    root.textContent = '';

    this.wrapperEl = document.createElement('div');
    this.wrapperEl.className = 'shell-wrapper';

    const header = document.createElement('header');
    header.className = 'shell-header';

    const homeLink = document.createElement('a');
    homeLink.className = 'shell-home-link';
    homeLink.href = basePath || '/';
    homeLink.textContent = 'Sandbox Playground';
    homeLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.callbacks.onHomeClick();
    });

    this.titleEl = document.createElement('span');
    this.titleEl.className = 'shell-current-title';

    this.hamburgerBtn = document.createElement('button');
    this.hamburgerBtn.type = 'button';
    this.hamburgerBtn.className = 'shell-hamburger';
    this.hamburgerBtn.setAttribute('aria-expanded', 'false');
    this.hamburgerBtn.setAttribute('aria-label', 'Open experiment navigation');
    this.hamburgerBtn.textContent = '☰';
    this.hamburgerBtn.addEventListener('click', () => this.toggleDrawer());

    this.themeBtn = document.createElement('button');
    this.themeBtn.type = 'button';
    this.themeBtn.className = 'shell-theme-toggle';
    this.themeBtn.setAttribute('aria-label', 'Toggle theme');
    this.themeBtn.addEventListener('click', () => this.callbacks.onToggleTheme());

    this.chromeBtn = document.createElement('button');
    this.chromeBtn.type = 'button';
    this.chromeBtn.className = 'shell-chrome-toggle';
    this.chromeBtn.setAttribute('aria-label', 'Hide chrome');
    this.chromeBtn.addEventListener('click', () => this.callbacks.onToggleChrome());

    header.append(homeLink, this.titleEl, this.hamburgerBtn, this.themeBtn, this.chromeBtn);

    this.appContainer = document.createElement('div');
    this.appContainer.className = 'shell-app';

    this.drawerBackdrop = document.createElement('div');
    this.drawerBackdrop.className = 'shell-drawer-backdrop';
    this.drawerBackdrop.hidden = true;
    this.drawerBackdrop.addEventListener('click', () => this.closeDrawer());

    this.drawerEl = document.createElement('aside');
    this.drawerEl.className = 'shell-drawer';
    this.drawerEl.setAttribute('role', 'dialog');
    this.drawerEl.setAttribute('aria-label', 'Experiment navigation');
    this.drawerEl.hidden = true;

    this.drawerSearch = document.createElement('input');
    this.drawerSearch.type = 'search';
    this.drawerSearch.className = 'shell-drawer-search';
    this.drawerSearch.placeholder = 'Search experiments…';
    this.drawerSearch.setAttribute('aria-label', 'Search experiments');
    this.drawerSearch.addEventListener('input', () => this.renderDrawerList());

    this.drawerList = document.createElement('div');
    this.drawerList.className = 'shell-drawer-list';

    this.drawerEl.append(this.drawerSearch, this.drawerList);
    this.focusTrap = createFocusTrap(this.drawerEl);
    this.drawerEl.addEventListener('keydown', (event) => this.focusTrap.handleKeydown(event));

    this.restoreBtn = document.createElement('button');
    this.restoreBtn.type = 'button';
    this.restoreBtn.className = 'shell-restore-chrome';
    this.restoreBtn.textContent = 'Show chrome';
    this.restoreBtn.hidden = true;
    this.restoreBtn.addEventListener('click', () => this.callbacks.onToggleChrome());

    this.wrapperEl.append(
      header,
      this.appContainer,
      this.drawerBackdrop,
      this.drawerEl,
      this.restoreBtn,
    );
    root.appendChild(this.wrapperEl);

    document.addEventListener('keydown', (event) => this.handleGlobalKeydown(event));
  }

  setExperimentTitle(title: string | null): void {
    this.titleEl.textContent = title ?? '';
    this.homeActive = title === null;
  }

  setChromeHidden(hidden: boolean): void {
    this.wrapperEl.classList.toggle('shell-chromeless', hidden);
    this.restoreBtn.hidden = !hidden;
    this.chromeBtn.setAttribute('aria-label', hidden ? 'Show chrome' : 'Hide chrome');
  }

  setTheme(theme: Theme): void {
    this.wrapperEl.setAttribute('data-shell-theme', theme);
    this.themeBtn.textContent = theme === 'dark' ? '☀️' : '\u{1F319}';
  }

  showLoading(): void {
    this.appContainer.textContent = '';
    const el = document.createElement('div');
    el.className = 'shell-loading';
    el.setAttribute('role', 'status');
    el.textContent = 'Loading…';
    this.appContainer.appendChild(el);
  }

  renderHome(registry: Registry): void {
    this.currentRegistry = registry;
    this.homeGridState = emptyGridState();
    this.setExperimentTitle(null);
    this.appContainer.textContent = '';

    const container = document.createElement('div');
    container.className = 'shell-home';

    const controls = document.createElement('div');
    controls.className = 'shell-home-controls';

    const search = document.createElement('input');
    search.type = 'search';
    search.className = 'shell-home-search';
    search.placeholder = 'Search experiments…';
    search.setAttribute('aria-label', 'Search experiments');
    this.homeSearchInput = search;

    const archivedToggle = document.createElement('label');
    archivedToggle.className = 'shell-archived-toggle';
    const archivedCheckbox = document.createElement('input');
    archivedCheckbox.type = 'checkbox';
    archivedToggle.append(archivedCheckbox, document.createTextNode(' Show archived'));

    const tagBar = document.createElement('div');
    tagBar.className = 'shell-tag-bar';
    for (const tag of collectTags(registry)) {
      const tagBtn = document.createElement('button');
      tagBtn.type = 'button';
      tagBtn.className = 'shell-tag-filter';
      tagBtn.textContent = tag;
      tagBtn.addEventListener('click', () => {
        const idx = this.homeGridState.tags.indexOf(tag);
        if (idx === -1) this.homeGridState.tags.push(tag);
        else this.homeGridState.tags.splice(idx, 1);
        tagBtn.classList.toggle('is-active', idx === -1);
        renderGrid();
      });
      tagBar.appendChild(tagBtn);
    }

    const grid = document.createElement('div');
    grid.className = 'shell-grid';

    const renderGrid = () => {
      grid.textContent = '';
      const results = filterEntries(this.currentRegistry, this.homeGridState);
      for (const entry of results) {
        grid.appendChild(this.buildCard(entry));
      }
      if (results.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'shell-grid-empty';
        empty.textContent = 'No experiments match.';
        grid.appendChild(empty);
      }
    };

    search.addEventListener('input', () => {
      this.homeGridState.query = search.value;
      renderGrid();
    });
    archivedCheckbox.addEventListener('change', () => {
      this.homeGridState.showArchived = archivedCheckbox.checked;
      renderGrid();
    });

    controls.append(search, archivedToggle);
    container.append(controls, tagBar, grid);
    this.appContainer.appendChild(container);
    renderGrid();
  }

  private buildCard(entry: RegistryEntry): HTMLElement {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'shell-card';
    card.addEventListener('click', () => this.callbacks.onSelect(entry.slug));

    const title = document.createElement('h3');
    title.className = 'shell-card-title';
    title.textContent = entry.title;

    card.appendChild(title);

    if (entry.description) {
      const desc = document.createElement('p');
      desc.className = 'shell-card-description';
      desc.textContent = entry.description;
      card.appendChild(desc);
    }

    if (entry.tags.length > 0) {
      const tags = document.createElement('div');
      tags.className = 'shell-card-tags';
      for (const tag of entry.tags) {
        const tagEl = document.createElement('span');
        tagEl.className = 'shell-card-tag';
        tagEl.textContent = tag;
        tags.appendChild(tagEl);
      }
      card.appendChild(tags);
    }

    return card;
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
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'shell-drawer-item';
      item.textContent = entry.title;
      item.addEventListener('click', () => {
        this.closeDrawer();
        this.callbacks.onSelect(entry.slug);
      });
      this.drawerList.appendChild(item);
    }
    if (results.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shell-drawer-empty';
      empty.textContent = 'No experiments match.';
      this.drawerList.appendChild(empty);
    }
  }

  toggleDrawer(): void {
    if (this.drawerOpen) this.closeDrawer();
    else this.openDrawer();
  }

  openDrawer(): void {
    if (this.drawerOpen) return;
    this.drawerOpen = true;
    this.lastFocused = document.activeElement as HTMLElement | null;
    this.drawerSearch.value = '';
    this.renderDrawerList();
    this.drawerBackdrop.hidden = false;
    this.drawerEl.hidden = false;
    this.hamburgerBtn.setAttribute('aria-expanded', 'true');
    this.drawerSearch.focus();
  }

  closeDrawer(): void {
    if (!this.drawerOpen) return;
    this.drawerOpen = false;
    this.drawerBackdrop.hidden = true;
    this.drawerEl.hidden = true;
    this.hamburgerBtn.setAttribute('aria-expanded', 'false');
    (this.lastFocused ?? this.hamburgerBtn).focus();
    this.lastFocused = null;
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
