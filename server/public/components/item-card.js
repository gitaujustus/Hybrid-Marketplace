import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class ItemCard extends LitElement {
  static properties = {
    item: { type: Object }
  };

  // Disable Shadow DOM to use global Tailwind CSS styles from the EJS shell
  createRenderRoot() {
    return this;
  }

  _formatPrice(price) {
    const value = Number(price) || 0;
    return `KSh ${value.toLocaleString()}`;
  }

  _handleNegotiate() {
    // We send a "bubble" event so the parent marketplace-app can catch it
    this.dispatchEvent(new CustomEvent('open-chat', {
      detail: { item: this.item }, // Pass the specific item data
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
          <div class="flex items-start justify-between">
            <h3 class="text-sm font-semibold text-slate-900">${this.item.name}</h3>
            <span class="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              ${this._formatPrice(this.item.price)}
            </span>
          </div>
          
          <p class="mt-1 text-xs text-slate-500 line-clamp-2">${this.item.description}</p>

          <div class="mt-4 flex flex-col gap-2">
            <button 
              @click="${this._handleNegotiate}"
              class="w-full rounded-lg bg-indigo-600 px-3 py-2 text-center text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
            >
              Negotiate Price
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

  _handleNegotiate() {
    this.dispatchEvent(new CustomEvent('open-chat', {
      detail: { item: this.item },
      bubbles: true,
      composed: true
    }));
  }

  _handleCheckout() {
    console.log('Checkout for:', this.item.name);
  }
}

customElements.define('item-card', ItemCard);


// import { LitElement, html, css } from 'https://cdn.jsdelivr.net/npm/lit@3.3.2/lit-all.min.js';

// export class ItemCard extends LitElement {
//   static properties = {
//     item: { type: Object }
//   };

//   static styles = css`
//     :host {
//       display: block;
//       border: 1px solid #ddd;
//       padding: 1rem;
//       margin: 0.5rem 0;
//       background: #f9f9f9;
//     }
//   `;

//   render() {
//     return html`
//       <h3>${this.item.name}</h3>
//       <p>${this.item.description}</p>
//       <p>Price: $${this.item.price}</p>
//     `;
//   }
// }

// customElements.define('item-card', ItemCard);