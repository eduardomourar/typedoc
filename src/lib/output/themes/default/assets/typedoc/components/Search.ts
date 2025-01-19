import { debounce } from "../utils/debounce.js";
import { Index } from "lunr";
import { decompressJson } from "../utils/decompress.js";
import { hideScrollbar, resetScrollbar } from "../utils/modal.js";

/**
 * Keep this in sync with the interface in src/lib/output/plugins/JavascriptIndexPlugin.ts
 * It's not imported because these are separate TS projects today.
 */
interface SearchDocument {
    id: number;

    kind: number;
    name: string;
    url: string;
    classes?: string;
    parent?: string;
}

interface IData {
    rows: SearchDocument[];
    index: object;
}

declare global {
    interface Window {
        searchData?: string;
    }
}

interface SearchState {
    base: string;
    data?: IData;
    index?: Index;
}

/** Counter to get unique IDs for options */
let optionsIdCounter = 0;

let resultCount = 0;

/**
 * Populates search data into `state`, if available.
 * Removes deault loading message
 */
async function updateIndex(state: SearchState, results: HTMLElement) {
    if (!window.searchData) return;

    try {
        const data: IData = await decompressJson(window.searchData);

        state.data = data;
        state.index = Index.load(data.index);

        results.querySelector("li.state")?.remove();
    } catch (e) {
        console.error(e);
        const message = window.translations.theme_search_index_not_available;
        const stateEl = createStateEl(message);
        results.replaceChildren(stateEl);
    }
}

export function initSearch() {
    const searchTrigger = document.getElementById(
        "tsd-search-trigger",
    ) as HTMLButtonElement | null;

    const searchEl = document.getElementById(
        "tsd-search",
    ) as HTMLDialogElement | null;

    const field = document.getElementById(
        "tsd-search-input",
    ) as HTMLInputElement | null;

    const results = document.getElementById("tsd-search-results");

    const searchScript = document.getElementById(
        "tsd-search-script",
    ) as HTMLScriptElement | null;

    if (!(searchTrigger && searchEl && field && results && searchScript)) {
        throw new Error("Search controls missing");
    }

    const state: SearchState = {
        base: document.documentElement.dataset.base! + "/",
    };

    searchScript.addEventListener("error", () => {
        const message = window.translations.theme_search_index_not_available;
        const stateEl = createStateEl(message);
        results.replaceChildren(stateEl);
    });
    searchScript.addEventListener("load", () => {
        updateIndex(state, results);
    });
    updateIndex(state, results);

    bindEvents(searchTrigger, searchEl, results, field, state);
}

function bindEvents(
    trigger: HTMLButtonElement,
    searchEl: HTMLDialogElement,
    results: HTMLElement,
    field: HTMLInputElement,
    state: SearchState,
) {
    trigger.addEventListener("click", () => openModal(searchEl));

    searchEl.addEventListener("close", resetScrollbar);
    searchEl.addEventListener("cancel", resetScrollbar);

    field.addEventListener(
        "input",
        debounce(() => {
            updateResults(results, field, state);
        }, 200),
    );

    field.addEventListener("keydown", (e) => {
        if (resultCount === 0 || e.ctrlKey || e.metaKey || e.altKey) {
            return;
        }

        // Get the visually focused element, if any
        const currentId = field.getAttribute("aria-activedescendant");
        const current = document.getElementById(currentId || "");

        // Remove visual focus on cursor position change
        if (current) {
            switch (e.key) {
                case "Home":
                case "End":
                case "ArrowLeft":
                case "ArrowRight":
                    removeVisualFocus(field);
            }
        }

        if (e.shiftKey) return;

        switch (e.key) {
            case "Enter":
                current?.querySelector("a")?.click();
                break;
            case "ArrowUp":
                setCurrentResult(results, field, current, -1);
                break;
            case "ArrowDown":
                setCurrentResult(results, field, current, 1);
                break;
        }
    });

    const _removeVisualFocus = () => removeVisualFocus(field);
    field.addEventListener("change", _removeVisualFocus);
    field.addEventListener("blur", _removeVisualFocus);

    /**
     * Start searching by pressing slash.
     */
    /*
    document.body.addEventListener("keypress", (e) => {
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (!field.matches(":focus") && e.key === "/") {
            e.preventDefault();
            field.focus();
        }
    });

    document.body.addEventListener("keyup", (e) => {
        if (
            searchEl.classList.contains("has-focus") &&
            (e.key === "Escape" ||
                (!results.matches(":focus-within") && !field.matches(":focus")))
        ) {
            field.blur();
            hideSearch(searchEl);
        }
    });
    */
}

function openModal(searchEl: HTMLDialogElement) {
    if (searchEl.open) return;
    hideScrollbar();
    searchEl.showModal();
}

function updateResults(
    results: HTMLElement,
    query: HTMLInputElement,
    state: SearchState,
) {
    // Don't clear results if loading state is not ready,
    // because loading or error message can be removed.
    if (!state.index || !state.data) return;

    results.innerHTML = "";
    optionsIdCounter += 1;

    const searchText = query.value.trim();

    // Perform a wildcard search
    let res: Index.Result[];
    if (searchText) {
        // Create a wildcard out of space-separated words in the query,
        // ignoring any extra spaces
        const searchWithWildcards = searchText
            .split(" ")
            .map((x) => {
                return x.length ? `*${x}*` : "";
            })
            .join(" ");
        res = state.index.search(searchWithWildcards);
    } else {
        // Set empty `res` to prevent getting random results with wildcard search
        // when the `searchText` is empty.
        res = [];
    }

    resultCount = res.length;

    if (res.length === 0) {
        const item = createStateEl(window.translations.theme_search_no_results);
        results.appendChild(item);
        return;
    }

    for (let i = 0; i < res.length; i++) {
        const item = res[i];
        const row = state.data.rows[Number(item.ref)];
        let boost = 1;

        // boost by exact match on name
        if (row.name.toLowerCase().startsWith(searchText.toLowerCase())) {
            boost *=
                1 + 1 / (1 + Math.abs(row.name.length - searchText.length));
        }

        item.score *= boost;
    }

    res.sort((a, b) => b.score - a.score);

    const c = Math.min(10, res.length);
    for (let i = 0; i < c; i++) {
        const row = state.data.rows[Number(res[i].ref)];
        const icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="tsd-kind-icon"><use href="#icon-${row.kind}"></use></svg>`;

        // Bold the matched part of the query in the search results
        let name = boldMatches(row.name, searchText);
        if (globalThis.DEBUG_SEARCH_WEIGHTS) {
            name += ` (score: ${res[i].score.toFixed(2)})`;
        }
        if (row.parent) {
            name = `<span class="parent">
                ${boldMatches(row.parent, searchText)}.</span>${name}`;
        }

        const item = document.createElement("li");
        item.id = `tsd-search:${optionsIdCounter}-${i}`;
        item.role = "option";
        item.ariaSelected = "false";
        item.classList.value = row.classes ?? "";

        const anchor = document.createElement("a");
        // Make links unfocusable inside option
        anchor.tabIndex = -1;
        anchor.href = state.base + row.url;
        anchor.innerHTML = icon + `<span class="text">${name}</span>`;
        item.append(anchor);

        results.appendChild(item);
    }
}

/**
 * Move the highlight within the result set.
 */
function setCurrentResult(
    results: HTMLElement,
    field: HTMLInputElement,
    current: Element | null,
    dir: 1 | -1,
) {
    let next: Element | null;
    // If there's no active descendant, select the first or last
    if (dir === 1) {
        next = current?.nextElementSibling || results.firstElementChild;
    } else {
        next = current?.previousElementSibling || results.lastElementChild;
    }

    // bad markup
    if (!next || next.role !== "option") {
        console.error("Option missing");
        return;
    }

    next.ariaSelected = "true";
    next.scrollIntoView({ behavior: "smooth", block: "nearest" });
    field.setAttribute("aria-activedescendant", next.id);
    current?.setAttribute("aria-selected", "false");
}

function removeVisualFocus(field: HTMLInputElement) {
    const currentId = field.getAttribute("aria-activedescendant");
    const current = document.getElementById(currentId || "");

    current?.setAttribute("aria-selected", "false");
    field.setAttribute("aria-activedescendant", "");
}

function boldMatches(text: string, search: string) {
    if (search === "") {
        return text;
    }

    const lowerText = text.toLocaleLowerCase();
    const lowerSearch = search.toLocaleLowerCase();

    const parts: string[] = [];
    let lastIndex = 0;
    let index = lowerText.indexOf(lowerSearch);
    while (index != -1) {
        parts.push(
            escapeHtml(text.substring(lastIndex, index)),
            `<b>${escapeHtml(
                text.substring(index, index + lowerSearch.length),
            )}</b>`,
        );

        lastIndex = index + lowerSearch.length;
        index = lowerText.indexOf(lowerSearch, lastIndex);
    }

    parts.push(escapeHtml(text.substring(lastIndex)));

    return parts.join("");
}

const SPECIAL_HTML = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;",
} as const;

function escapeHtml(text: string) {
    return text.replace(
        /[&<>"'"]/g,
        (match) => SPECIAL_HTML[match as keyof typeof SPECIAL_HTML],
    );
}

/**
 * Returns a `li` element, with `state` class,
 * @param message Message to set as **innerHTML**
 */
function createStateEl(message: string) {
    const stateEl = document.createElement("li");
    stateEl.className = "state";
    stateEl.innerHTML = message;
    return stateEl;
}
