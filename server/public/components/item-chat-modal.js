import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class ItemChatModal extends LitElement {
  static properties = {
    open: { type: Boolean },
    inline: { type: Boolean },
    item: { type: Object },
    currentUser: { type: Object },
    otherUserId: { type: String },
    otherUserName: { type: String },
    messages: { type: Array },
    loading: { type: Boolean },
    error: { type: String },
    draft: { type: String },
    offerValue: { type: String }
  };

  constructor() {
    super();
    this.open = false;
    this.inline = false;
    this.item = null;
    this.currentUser = null;
    this.otherUserId = '';
    this.otherUserName = '';
    this.messages = [];
    this.loading = false;
    this.error = '';
    this.draft = '';
    this.offerValue = '';
    this.lastTimestamp = null;
    this.pollTimer = null;
  }

  createRenderRoot() {
    return this;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopPolling();
  }

  willUpdate(changed) {
    const visibilityChanged = changed.has('open') || changed.has('inline');
    const threadChanged = changed.has('item') || changed.has('currentUser') || changed.has('otherUserId');
    const isVisible = this.inline || this.open;

    if (visibilityChanged || threadChanged) {
      if (isVisible && this.item?.id && this.currentUser?.id && this.otherUserId) {
        this._initializeThread();
      } else if (!isVisible) {
        this._stopPolling();
      }
    }
  }

  _formatPrice(value) {
    const amount = Number(value) || 0;
    return `KSh ${amount.toLocaleString()}`;
  }

  _close() {
    this.dispatchEvent(new CustomEvent('close-chat', { bubbles: true, composed: true }));
  }

  async _initializeThread() {
    if (!this.item?.id || !this.currentUser?.id || !this.otherUserId) return;
    this.loading = true;
    this.error = '';
    this.messages = [];
    this.lastTimestamp = null;
    this._stopPolling();

    try {
      const data = await this._fetchThread();
      this.messages = data.messages || [];
      this.lastTimestamp = data.lastTimestamp || null;
      this._startPolling();
    } catch (error) {
      this.error = error.message || 'Failed to load chat';
    } finally {
      this.loading = false;
    }
  }

  _startPolling() {
    this._stopPolling();
    this.pollTimer = setInterval(() => this._pollThread(), 2000);
  }

  _stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async _fetchThread(since = null) {
    const params = new URLSearchParams({
      itemId: this.item.id,
      userId: this.currentUser.id,
      otherUserId: this.otherUserId
    });
    if (since) params.set('since', since);

    const res = await fetch(`/api/messages/thread?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch thread');
    }
    return data;
  }

  async _pollThread() {
    const isVisible = this.inline || this.open;
    if (!isVisible || !this.item || !this.currentUser || !this.otherUserId) return;
    try {
      const data = await this._fetchThread(this.lastTimestamp);
      if (data.messages?.length) {
        this.messages = [...this.messages, ...data.messages];
      }
      if (data.lastTimestamp) {
        this.lastTimestamp = data.lastTimestamp;
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }

  async _sendTextMessage() {
    const content = this.draft.trim();
    if (!content) return;

    await this._sendMessage({ type: 'text', content });
    this.draft = '';
  }

  async _sendOffer() {
    const numericOffer = Number(this.offerValue);
    if (!numericOffer || numericOffer <= 0) {
      alert('Enter a valid offer amount');
      return;
    }
    await this._sendMessage({ type: 'offer', offerAmount: numericOffer });
    this.offerValue = '';
  }

  async _sendMessage(payload) {
    try {
      const res = await fetch('/api/messages/thread/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: this.item.id,
          senderId: this.currentUser.id,
          senderName: this.currentUser.name,
          receiverId: this.otherUserId,
          ...payload
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      this.messages = [...this.messages, data];
      this.lastTimestamp = data.timestamp;
    } catch (error) {
      alert(error.message || 'Failed to send message');
    }
  }

  async _handleOfferAction(messageId, action) {
    try {
      let counterAmount = null;
      if (action === 'counter') {
        const input = prompt('Enter your counter offer amount in KSh:');
        if (!input) return;
        counterAmount = Number(input);
        if (!counterAmount || counterAmount <= 0) {
          alert('Invalid counter amount');
          return;
        }
      }

      const res = await fetch(`/api/messages/offers/${messageId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId: this.currentUser.id,
          userName: this.currentUser.name,
          counterAmount
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process offer action');

      await this._initializeThread();
      this.dispatchEvent(new CustomEvent('thread-updated', { bubbles: true, composed: true }));
    } catch (error) {
      alert(error.message || 'Failed to process offer action');
    }
  }

  _renderMessage(message) {
    const mine = message.senderId === this.currentUser?.id;
    const bubbleClass = mine
      ? 'bg-indigo-600 text-white ml-auto'
      : 'bg-slate-100 text-slate-900 mr-auto';

    if (message.type === 'offer') {
      const canRespond = !mine && message.offerStatus === 'pending';
      return html`
        <div class="max-w-[85%] rounded-xl p-3 ${bubbleClass}">
          <p class="text-xs opacity-80">${mine ? 'You made an offer' : `${message.senderName} made an offer`}</p>
          <p class="mt-1 text-sm font-semibold">${this._formatPrice(message.offerAmount)}</p>
          <p class="mt-1 text-xs">Status: ${message.offerStatus}</p>
          ${canRespond
            ? html`
              <div class="mt-3 flex flex-wrap gap-2">
                <button @click=${() => this._handleOfferAction(message.id, 'accept')} class="rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
                  Accept
                </button>
                <button @click=${() => this._handleOfferAction(message.id, 'reject')} class="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
                  Reject
                </button>
                <button @click=${() => this._handleOfferAction(message.id, 'counter')} class="rounded-md bg-amber-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-600">
                  Counter
                </button>
              </div>
            `
            : ''}
          <p class="mt-2 text-[11px] opacity-70">${new Date(message.timestamp).toLocaleString()}</p>
        </div>
      `;
    }

    return html`
      <div class="max-w-[85%] rounded-xl p-3 ${bubbleClass}">
        <p class="text-sm">${message.content}</p>
        <p class="mt-2 text-[11px] opacity-70">${new Date(message.timestamp).toLocaleString()}</p>
      </div>
    `;
  }

  render() {
    const isVisible = this.inline || this.open;
    if (!isVisible) return html``;

    const containerClass = this.inline
      ? 'mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm'
      : 'w-full max-w-2xl rounded-t-2xl bg-white shadow-xl sm:rounded-2xl';
    const wrapperStart = this.inline
      ? html``
      : html`<div class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">`;
    const wrapperEnd = this.inline ? html`` : html`</div>`;
    const messagesHeightClass = this.inline ? 'h-[40vh]' : 'h-[52vh]';

    return html`
      ${wrapperStart}
        <div class="${containerClass}">
          <div class="flex items-center justify-between border-b border-slate-200 p-4">
            <div>
              <h3 class="text-base font-semibold text-slate-900">${this.item?.name || 'Item Chat'}</h3>
              <p class="text-xs text-slate-500">Chat with ${this.otherUserName || 'user'}</p>
            </div>
            ${this.inline
              ? html``
              : html`<button @click=${this._close} class="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">Close</button>`}
          </div>

          <div class="${messagesHeightClass} overflow-y-auto p-4">
            ${this.loading
              ? html`<p class="text-sm text-slate-500">Loading messages...</p>`
              : this.error
                ? html`<p class="text-sm text-red-600">${this.error}</p>`
                : this.messages.length === 0
                  ? html`<p class="text-sm text-slate-500">No messages yet. Start the conversation.</p>`
                  : html`<div class="flex flex-col gap-3">${this.messages.map(msg => this._renderMessage(msg))}</div>`}
          </div>

          <div class="border-t border-slate-200 p-4">
            <div class="mb-2">
              <h4 class="text-sm font-semibold text-slate-900">Negotiate Price</h4>
              <p class="text-xs text-slate-500">Send an offer amount or continue with normal chat messages.</p>
            </div>

            <div class="flex gap-2">
              <input
                type="number"
                min="1"
                .value=${this.offerValue}
                @input=${(e) => { this.offerValue = e.target.value; }}
                placeholder="Negotiate price amount (KSh)"
                class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <button @click=${this._sendOffer} class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Negotiate Price
              </button>
            </div>

            <div class="mt-3 flex gap-2">
              <input
                .value=${this.draft}
                @input=${(e) => { this.draft = e.target.value; }}
                @keydown=${(e) => { if (e.key === 'Enter') this._sendTextMessage(); }}
                placeholder="Type your message..."
                class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <button @click=${this._sendTextMessage} class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                Send
              </button>
            </div>
          </div>
        </div>
      ${wrapperEnd}
    `;
  }
}

customElements.define('item-chat-modal', ItemChatModal);
