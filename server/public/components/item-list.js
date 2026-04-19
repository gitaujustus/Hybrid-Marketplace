// import { LitElement, html, css } from 'https://cdn.jsdelivr.net/npm/lit@3.3.2/lit-all.min.js';

// export class ItemList extends LitElement {
//   static properties = {
//     items: { type: Array },
//     query: { type: String }
//   };

//   static styles = css`
//     :host {
//       display: block;
//     }
//     .empty {
//       text-align: center;
//       padding: 2rem;
//       color: #64748b;
//     }
//     .item {
//       border: 1px solid #ddd;
//       padding: 1rem;
//       margin: 0.5rem 0;
//       background: #f9f9f9;
//     }
//   `;

//   constructor() {
//     super();
//     this.items = [];
//     this.query = '';
//   }

//   connectedCallback() {
//     super.connectedCallback();
//     this.fetchItems();
//   }

//   async fetchItems() {
//     const response = await fetch(`/api/items?search=${this.query}`);
//     if (response.ok) {
//       this.items = await response.json();
//     } else {
//       this.items = [];
//     }
//   }

//   render() {
//     return html`
//       <section>
//         <input
//           type="search"
//           placeholder="Search items"
//           .value=${this.query}
//           @input=${this._onSearch}
//         />
//         <button @click=${this.fetchItems}>Search</button>
//       </section>

//       ${this.items.length === 0
//         ? html`<div class="empty">No items found.</div>`
//         : html`<div>${this.items.map(item => html`<div class="item"><h3>${item.name}</h3><p>${item.description}</p></div>`)}</div>`}
//     `;
//   }

//   _onSearch(event) {
//     this.query = event.target.value;
//   }
// }

// customElements.define('item-list', ItemList);