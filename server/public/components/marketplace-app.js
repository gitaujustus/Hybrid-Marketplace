import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import './item-card.js'; 

class MarketplaceApp extends LitElement {
  static properties = {
    items: { type: Array },
    filteredItems: { type: Array },
    loading: { type: Boolean }
  };

  constructor() {
    super();
    this.items = [];
    this.filteredItems = [];
    this.loading = true;
  }

  _formatPrice(price) {
    const value = Number(price) || 0;
    return `KSh ${value.toLocaleString()}`;
  }

  createRenderRoot() {
    return this;
  }

  async connectedCallback() {
    super.connectedCallback();
    await this.fetchItems();
  }

  async fetchItems() {
    try {
      this.loading = true;
      const response = await fetch('/api/items');
      const data = await response.json();
      this.items = data;
      this.filteredItems = data;
    } catch (error) {
      console.error('Error fetching marketplace items:', error);
    } finally {
      this.loading = false;
    }
  }

  _handleSearch(e) {
    const query = e.target.value.toLowerCase();
    this.filteredItems = this.items.filter(item => 
      item.name.toLowerCase().includes(query) || 
      item.description.toLowerCase().includes(query)
    );
  }

  _onOpenItem(e) {
    const item = e.detail.item;
    window.location.href = `/items/${encodeURIComponent(item.id)}`;
  }

  async _onCheckout(e) {
    const item = e.detail.item;
    const confirmPurchase = confirm(`Proceed to checkout for ${item.name} at ${this._formatPrice(item.price)}?`);
    
    if (confirmPurchase) {
      try {
        // Calling your backend PUT route to update status or remove item
        const response = await fetch(`/api/items/${item.id}`, {
          method: 'DELETE', // Standard marketplace practice: remove item once sold
        });

        if (response.ok) {
          alert("Purchase successful! Item removed from marketplace.");
          await this.fetchItems(); // Refresh the list
        }
      } catch (err) {
        console.error("Checkout failed:", err);
      }
    }
  }

  render() {
    return html`
      <div class="mb-8">
        <div class="relative max-w-md">
          <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input 
            type="text" 
            placeholder="Search collectibles..." 
            @input="${this._handleSearch}"
            class="block w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      ${this.loading 
        ? html`
            <div class="flex flex-col items-center justify-center py-20">
              <div class="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
              <p class="mt-4 text-slate-500 font-medium">Curating items...</p>
            </div>
          `
        : html`
            <div 
              class="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              @open-item="${this._onOpenItem}"
              @checkout-item="${this._onCheckout}"
            >
              ${this.filteredItems.length > 0 
                ? this.filteredItems.map(item => html`
                    <item-card .item="${item}"></item-card>
                  `)
                : html`
                    <div class="col-span-full py-20 text-center">
                      <p class="text-lg text-slate-500">No items found matching your search.</p>
                    </div>
                  `
              }
            </div>
          `
      }

    `;
  }
}

customElements.define('marketplace-app', MarketplaceApp);


// import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
// import './item-card.js'; 

// class MarketplaceApp extends LitElement {
//   static properties = {
//     items: { type: Array },
//     filteredItems: { type: Array },
//     loading: { type: Boolean }
//   };

//   constructor() {
//     super();
//     this.items = [];
//     this.filteredItems = [];
//     this.loading = true;
//   }

//   // Use the global Tailwind styles from your EJS shell
//   createRenderRoot() {
//     return this;
//   }

//   // 1. LIFECYCLE: This runs when the component is added to the page
//   async connectedCallback() {
//     super.connectedCallback();
//     await this.fetchItems();
//   }

//   // 2. FETCH LOGIC: The actual code responsible for getting data from your server
//   async fetchItems() {
//     try {
//       this.loading = true;
//       // Reaches out to the Express API route defined in your server.js
//       const response = await fetch('/api/items');
//       const data = await response.json();
      
//       this.items = data;
//       this.filteredItems = data; // Initialize filtered list with all data
//     } catch (error) {
//       console.error('Error fetching marketplace items:', error);
//     } finally {
//       this.loading = false;
//     }
//   }

//   // 3. SEARCH LOGIC: Handles the "Search for items quickly" requirement
//   _handleSearch(e) {
//     const query = e.target.value.toLowerCase();
//     this.filteredItems = this.items.filter(item => 
//       item.name.toLowerCase().includes(query) || 
//       item.description.toLowerCase().includes(query)
//     );
//   }

//   render() {
//     return html`
//       <div class="mb-8">
//         <div class="relative max-w-md">
//           <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
//             <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
//             </svg>
//           </span>
//           <input 
//             type="text" 
//             placeholder="Search collectibles..." 
//             @input="${this._handleSearch}"
//             class="block w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
//           />
//         </div>
//       </div>

//       ${this.loading 
//         ? html`
//             <div class="flex flex-col items-center justify-center py-20">
//               <div class="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"></div>
//               <p class="mt-4 text-slate-500 font-medium">Curating items...</p>
//             </div>
//           `
//         : html`
//             <div class="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
//               ${this.filteredItems.length > 0 
//                 ? this.filteredItems.map(item => html`
//                     <item-card .item="${item}"></item-card>
//                   `)
//                 : html`
//                     <div class="col-span-full py-20 text-center">
//                       <p class="text-lg text-slate-500">No items found matching your search.</p>
//                     </div>
//                   `
//               }
//             </div>
//           `
//       }
//     `;
//   }
// }

// customElements.define('marketplace-app', MarketplaceApp);