import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { getUser } from '/utils/auth.js';
import './item-chat-modal.js';

class ItemDetailPage extends LitElement {
  static properties = {
    itemId: { type: String, attribute: 'item-id' },
    item: { type: Object },
    currentUser: { type: Object },
    loading: { type: Boolean },
    error: { type: String },
    conversations: { type: Array },
    chatOtherUserId: { type: String },
    chatOtherUserName: { type: String },
    paymentPhone: { type: String },
    paymentError: { type: String },
    paymentSubmitting: { type: Boolean },
    showPaymentConfirm: { type: Boolean }
  };

  constructor() {
    super();
    this.itemId = '';
    this.item = null;
    this.currentUser = null;
    this.loading = true;
    this.error = '';
    this.conversations = [];
    this.chatOtherUserId = '';
    this.chatOtherUserName = '';
    this.paymentPhone = '';
    this.paymentError = '';
    this.paymentSubmitting = false;
    this.showPaymentConfirm = false;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.currentUser = getUser();
    this._loadPageData();
  }

  async _loadPageData() {
    await this._fetchItem();
    if (!this.currentUser?.id || !this.item?.id) return;

    if (this.item.sellerId === this.currentUser.id) {
      await this._fetchItemConversations();
      const firstConversation = this.conversations[0];
      if (firstConversation) {
        this.chatOtherUserId = firstConversation.otherUserId;
        this.chatOtherUserName = firstConversation.otherUserName || 'Buyer';
      }
    } else {
      this.chatOtherUserId = this.item.sellerId;
      this.chatOtherUserName = this.item.sellerName || 'Seller';
    }
  }

  _formatPrice(value) {
    const amount = Number(value) || 0;
    return `KSh ${amount.toLocaleString()}`;
  }

  _normalizeMpesaNumber(rawPhone) {
    const digits = String(rawPhone || '').replace(/\D/g, '');
    if (/^07\d{8}$/.test(digits) || /^01\d{8}$/.test(digits)) {
      return `254${digits.slice(1)}`;
    }
    if (/^254(7|1)\d{8}$/.test(digits)) {
      return digits;
    }
    return null;
  }

  _getPayableAmount() {
    if (!this.item || !this.currentUser) return Number(this.item?.price || 0);
    const isAcceptedBuyer =
      this.item.acceptedOffer &&
      this.item.acceptedBuyerId &&
      this.item.acceptedBuyerId === this.currentUser.id;
    return Number(isAcceptedBuyer ? this.item.acceptedOffer : this.item.price);
  }

  async _fetchItem() {
    try {
      this.loading = true;
      this.error = '';
      const res = await fetch(`/api/items/${encodeURIComponent(this.itemId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch item');
      this.item = data;
    } catch (error) {
      this.error = error.message || 'Failed to load item';
    } finally {
      this.loading = false;
    }
  }

  async _fetchItemConversations() {
    try {
      const res = await fetch(`/api/messages/conversations/${encodeURIComponent(this.currentUser.id)}?itemId=${encodeURIComponent(this.itemId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch item conversations');
      this.conversations = data;
    } catch (error) {
      console.error(error);
      this.conversations = [];
    }
  }

  _openConversation(conversation) {
    this.chatOtherUserId = conversation.otherUserId;
    this.chatOtherUserName = conversation.otherUserName || 'Buyer';
  }

  _initiatePayment() {
    const normalizedPhone = this._normalizeMpesaNumber(this.paymentPhone);
    if (!normalizedPhone) {
      this.paymentError = 'Enter a valid M-Pesa number (07..., 01..., or 2547...)';
      return;
    }
    this.paymentError = '';
    this.showPaymentConfirm = true;
  }

  async _confirmAndSubmit() {
    if (!this.currentUser || !this.item) return;

    this.showPaymentConfirm = false;
    this.paymentSubmitting = true;
    const normalizedPhone = this._normalizeMpesaNumber(this.paymentPhone);
    
    try {
      const amount = this._getPayableAmount();
      const res = await fetch(`/api/items/${encodeURIComponent(this.item.id)}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: this.currentUser.id,
          mpesaNumber: normalizedPhone,
          amount
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');

      this.paymentPhone = '';
      alert('Payment prompt sent to your phone!');
      await this._loadPageData();
    } catch (error) {
      this.paymentError = error.message || 'Payment failed';
    } finally {
      this.paymentSubmitting = false;
    }
  }

  render() {
    if (this.loading) {
      return html`<p class="text-sm text-slate-500">Loading item details...</p>`;
    }
    if (this.error || !this.item) {
      return html`<p class="text-sm text-red-600">${this.error || 'Item not found'}</p>`;
    }

    const isSeller = this.currentUser?.id === this.item.sellerId;
    const payableAmount = this._getPayableAmount();
    const isBuyer = this.currentUser && !isSeller;
    const alreadyPaidByCurrentBuyer =
      this.item.paymentStatus === 'paid' &&
      this.item.paymentConfirmedBy === this.currentUser?.id;

    return html`
      <a href="/" class="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700">← Back to marketplace</a>

      ${this.showPaymentConfirm ? html`
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 class="text-lg font-bold text-slate-900">Confirm Payment</h3>
            <p class="mt-2 text-sm text-slate-600">
              You are about to pay <span class="font-bold text-indigo-600">${this._formatPrice(payableAmount)}</span> 
              for <strong>${this.item.name}</strong> using M-Pesa number <strong>${this.paymentPhone}</strong>.
            </p>
            <p class="mt-2 text-xs text-slate-500 italic">A STK push prompt will be sent to your phone shortly after clicking confirm.</p>
            <div class="mt-6 flex justify-end gap-3">
              <button 
                @click=${() => this.showPaymentConfirm = false}
                class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button 
                @click=${this._confirmAndSubmit}
                class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                Confirm & Pay
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-1">
          <img src="${this.item.image || 'https://via.placeholder.com/600'}" alt="${this.item.name}" class="h-full w-full object-cover" />
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <h1 class="text-2xl font-bold text-slate-900">${this.item.name}</h1>
            <span class="inline-flex items-center rounded-md bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              ${this._formatPrice(this.item.price)}
            </span>
          </div>
          <p class="mt-2 text-sm text-slate-600">Sold by ${this.item.sellerName || 'Unknown seller'}</p>
          <p class="mt-4 text-slate-700">${this.item.description}</p>
        </div>
      </div>

      ${isBuyer ? html`
        <section class="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-slate-900">Payment</h2>
          <p class="mt-1 text-sm text-slate-600">
            Amount due: <span class="font-semibold text-slate-900">${this._formatPrice(payableAmount)}</span>
          </p>

          ${alreadyPaidByCurrentBuyer ? html`
            <p class="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Payment confirmed.</p>
          ` : html`
            <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <div class="flex-1">
                <label class="mb-1 block text-sm font-medium text-slate-700">M-Pesa Number</label>
                <input
                  .value=${this.paymentPhone}
                  @input=${(e) => { this.paymentPhone = e.target.value; }}
                  placeholder="07XXXXXXXX"
                  class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>
              <button
                @click=${this._initiatePayment}
                ?disabled=${this.paymentSubmitting}
                class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                ${this.paymentSubmitting ? 'Processing...' : 'Make Payment'}
              </button>
            </div>
            ${this.paymentError ? html`<p class="mt-2 text-sm text-red-600">${this.paymentError}</p>` : ''}
          `}
        </section>
      ` : ''}

      ${isSeller ? html`
        <section class="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-slate-900">Buyer Conversations</h2>
          <p class="mt-1 text-sm text-slate-600">See who contacted you about this listing.</p>
          <div class="mt-4 space-y-3">
            ${this.conversations.length === 0
              ? html`<p class="text-sm text-slate-500">No buyer messages for this item yet.</p>`
              : this.conversations.map(conv => html`
                  <button
                    @click=${() => this._openConversation(conv)}
                    class="w-full rounded-xl border border-slate-200 p-3 text-left hover:bg-slate-50 transition"
                  >
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <p class="text-sm font-semibold text-slate-900">${conv.otherUserName}</p>
                        <p class="mt-1 text-xs text-slate-600">
                          ${conv.lastMessage.type === 'offer'
                            ? `Offer: ${this._formatPrice(conv.lastMessage.offerAmount)}`
                            : conv.lastMessage.content || 'Message'}
                        </p>
                      </div>
                      <div class="text-right">
                        ${conv.unreadCount > 0 ? html`<span class="rounded-full bg-indigo-600 px-2 py-1 text-xs font-semibold text-white">${conv.unreadCount}</span>` : ''}
                        <p class="mt-1 text-xs text-slate-400">${new Date(conv.lastMessage.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  </button>
              `)}
          </div>
        </section>
      ` : ''}

      ${this.currentUser
        ? this.chatOtherUserId
          ? html`
              <item-chat-modal
                .inline=${true}
                .open=${true}
                .item=${this.item}
                .currentUser=${this.currentUser}
                .otherUserId=${this.chatOtherUserId}
                .otherUserName=${this.chatOtherUserName}
                @thread-updated=${() => this._loadPageData()}
              ></item-chat-modal>
            `
          : html`
              <section class="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
                <p class="text-sm text-slate-500">
                  ${isSeller
                    ? 'Chat will appear here when a buyer sends the first message for this listing.'
                    : 'Chat is unavailable for this listing right now. Please try again later.'}
                </p>
              </section>
            `
        : ''}
    `;
  }
}

customElements.define('item-detail-page', ItemDetailPage);
