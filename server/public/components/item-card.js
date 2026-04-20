import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class ItemCard extends LitElement {
  static properties = {
    item: { type: Object }
  };

  createRenderRoot() {
    return this;
  }

  _formatPrice(price) {
    const value = Number(price) || 0;
    return `KSh ${value.toLocaleString()}`;
  }

  render() {
    if (!this.item) return html``;

    return html`
      <div class="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all hover:shadow-lg">
        <div class="aspect-square overflow-hidden bg-slate-100">
          <img 
            src="${this.item.image || 'https://via.placeholder.com/300'}" 
            alt="${this.item.name}" 
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>

        <div class="flex flex-1 flex-col p-4">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-slate-900">${this.item.name}</h3>
            <span class="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              ${this._formatPrice(this.item.price)}
            </span>
          </div>
          
          <p class="mt-1 text-xs text-slate-500 line-clamp-2">${this.item.description}</p>

          <div class="mt-4 flex flex-col gap-2">
            <button 
              @click="${this._handleReadMore}"
              class="w-full rounded-lg bg-indigo-600 px-3 py-2 text-center text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
            >
              Read More
            </button>
            <button 
              @click="${this._handleCheckout}"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Buy Now
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _handleReadMore() {
    this.dispatchEvent(new CustomEvent('open-item', {
      detail: { item: this.item },
      bubbles: true,
      composed: true
    }));
  }

  _handleCheckout() {
    this.dispatchEvent(new CustomEvent('checkout-item', {
      detail: { item: this.item },
      bubbles: true,
      composed: true
    }));
  }
}

customElements.define('item-card', ItemCard);