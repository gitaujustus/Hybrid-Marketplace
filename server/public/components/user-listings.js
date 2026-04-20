import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { getUser } from '/utils/auth.js';

class UserListings extends LitElement {
  static properties = {
    items: { type: Array },
    loading: { type: Boolean },
    error: { type: String },
    user: { type: Object }
  };

  constructor() {
    super();
    this.items = [];
    this.loading = true;
    this.error = '';
    this.user = null;
  }

  createRenderRoot() {
    return this;
  }

  _formatPrice(price) {
    const value = Number(price) || 0;
    return `KSh ${value.toLocaleString()}`;
  }

  connectedCallback() {
    super.connectedCallback();
    this.user = getUser();
    this._fetchMyListings();
  }

  async _fetchMyListings() {
    if (!this.user?.id) {
      this.loading = false;
      return;
    }

    try {
      this.loading = true;
      this.error = '';
      const res = await fetch(`/api/items/user/${encodeURIComponent(this.user.id)}`);
      if (!res.ok) throw new Error(`Failed to load listings (${res.status})`);
      this.items = await res.json();
    } catch (e) {
      console.error('Error fetching user listings:', e);
      this.error = e?.message || 'Failed to load your listings';
    } finally {
      this.loading = false;
    }
  }

  async _deleteListing(item) {
    const ok = confirm(`Delete "${item.name}"? This cannot be undone.`);
    if (!ok) return;

    try {
      const res = await fetch(`/api/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      await this._fetchMyListings();
    } catch (e) {
      console.error('Error deleting listing:', e);
      alert(e?.message || 'Failed to delete listing');
    }
  }

  render() {
    if (!this.user) {
      return html`
        <div class="rounded-2xl border border-slate-200 bg-white p-6">
          <h3 class="text-lg font-semibold text-slate-900">You’re not logged in</h3>
          <p class="mt-1 text-sm text-slate-600">Log in to view and manage your listings.</p>
          <div class="mt-4 flex gap-3">
            <a href="/login" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition">Login</a>
            <a href="/signup" class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Sign up</a>
          </div>
        </div>
      `;
    }

    if (this.loading) {
      return html`
        <div class="flex flex-col items-center justify-center py-16">
          <div class="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
          <p class="mt-3 text-slate-500 font-medium">Loading your listings...</p>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="rounded-2xl border border-red-200 bg-red-50 p-6">
          <p class="text-sm font-medium text-red-800">${this.error}</p>
          <button @click=${this._fetchMyListings} class="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 transition">
            Retry
          </button>
        </div>
      `;
    }

    return html`
      <div class="flex items-center justify-between gap-4">
        <div>
          <h3 class="text-xl font-semibold text-slate-900">Listings by ${this.user.name}</h3>
          <p class="mt-1 text-sm text-slate-600">${this.items.length} item(s)</p>
        </div>
        <div class="flex items-center gap-2">
          <a href="/add-listing" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition">
            Add a Listing
          </a>
          <button @click=${this._fetchMyListings} class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            Refresh
          </button>
        </div>
      </div>

      <div class="mt-6 grid grid-cols-1 gap-4">
        ${this.items.length === 0
          ? html`
              <div class="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                <p class="text-slate-600">You don’t have any listings yet.</p>
                <p class="mt-1 text-sm text-slate-500">Create one from the marketplace page using your logged-in account.</p>
              </div>
            `
          : this.items.map(item => html`
              <div class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="flex items-center gap-4">
                  <img
                    src="${item.image || 'https://via.placeholder.com/96'}"
                    alt="${item.name}"
                    class="h-16 w-16 rounded-xl object-cover bg-slate-100 ring-1 ring-inset ring-slate-200"
                  />
                  <div>
                    <div class="flex items-center gap-2">
                      <h4 class="text-sm font-semibold text-slate-900">${item.name}</h4>
                      <span class="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                        ${this._formatPrice(item.price)}
                      </span>
                    </div>
                    <p class="mt-1 text-xs text-slate-600 line-clamp-2">${item.description}</p>
                    <p class="mt-1 text-xs text-slate-400">Created: ${new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div class="flex gap-2 sm:shrink-0">
                  <button
                    @click=${() => this._deleteListing(item)}
                    class="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            `)
        }
      </div>
    `;
  }
}

customElements.define('user-listings', UserListings);

