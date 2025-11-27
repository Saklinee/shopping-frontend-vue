new Vue({
  el: '#app',
  data: {
    lessons: [],
    sortBy: 'topic',
    sortDir: 'asc',
    showCart: false,
    cart: [],
    customer: {
      name: '',
      phone: ''
    },
    payment: {
      cardNumber: '',
      expiry: '',
      cvc: ''
    },
    confirmation: '',
    searchText: '',
    isSearching: false,
    searchTimeoutId: null,
    isCheckingOut: false,
    apiBaseUrl: 'https://shopping-backend-express.onrender.com'
  },
  computed: {
    sortedLessons() {
      return [...this.lessons].sort((a, b) => {
        const modifier = this.sortDir === 'asc' ? 1 : -1;
        if (a[this.sortBy] < b[this.sortBy]) return -1 * modifier;
        if (a[this.sortBy] > b[this.sortBy]) return 1 * modifier;
        return 0;
      });
    },
    validName() {
      return /^[A-Za-z\s]+$/.test(this.customer.name);
    },
    validPhone() {
      return /^\d+$/.test(this.customer.phone);
    },
    cartTotal() {
      return this.cart.reduce(
        (sum, item) => sum + Number(item.price || 0),
        0
      );
    },
    validCard() {
      const digits = this.payment.cardNumber.replace(/\s+/g, '');
      return /^\d{16}$/.test(digits);
    },
    validExpiry() {
      const match = /^(\d{2})\/(\d{2})$/.exec(this.payment.expiry);
      if (!match) return false;
      const month = Number(match[1]);
      return month >= 1 && month <= 12;
    },
    validCvc() {
      return /^\d{3,4}$/.test(this.payment.cvc);
    },
    checkoutDisabled() {
      return (
        !this.validName ||
        !this.validPhone ||
        !this.validCard ||
        !this.validExpiry ||
        !this.validCvc ||
        this.cart.length === 0 ||
        this.isCheckingOut
      );
    }
  },
  watch: {
    searchText(newVal) {
      const q = newVal.trim();
      if (this.searchTimeoutId) {
        clearTimeout(this.searchTimeoutId);
      }
      this.searchTimeoutId = setTimeout(() => {
        if (!q) {
          this.fetchLessons();
        } else {
          this.fetchSearchResults();
        }
      }, 300);
    }
  },
  methods: {
    addToCart(lesson) {
      const lessonInList = this.lessons.find(item => item._id === lesson._id);
      if (lessonInList && lessonInList.space > 0) {
        this.cart.push(lesson);
        lessonInList.space--;
      }
    },
    removeFromCart(index) {
      const removedItem = this.cart.splice(index, 1)[0];
      const lessonInList = this.lessons.find(item => item._id === removedItem._id);
      if (lessonInList) {
        lessonInList.space++;
      }
    },

    // --- UPDATED ICON FUNCTION (Matches keywords inside the name) ---
    getLessonIcon(topic) {
      const t = topic.toLowerCase();
      
      if (t.includes('math') || t.includes('algebra') || t.includes('geometry') || t.includes('calculus')) return 'fa-calculator';
      if (t.includes('biology')) return 'fa-dna';
      if (t.includes('chemistry')) return 'fa-flask';
      if (t.includes('physics')) return 'fa-atom';
      if (t.includes('science')) return 'fa-flask'; // fallback for general science
      if (t.includes('english') || t.includes('writing') || t.includes('literature')) return 'fa-pen-nib';
      if (t.includes('art') || t.includes('design')) return 'fa-palette';
      if (t.includes('history')) return 'fa-landmark';
      if (t.includes('geography')) return 'fa-earth-americas';
      if (t.includes('computer') || t.includes('code') || t.includes('ict')) return 'fa-laptop-code';
      if (t.includes('music')) return 'fa-music';
      if (t.includes('sport') || t.includes('pe') || t.includes('fitness')) return 'fa-futbol';
      
      return 'fa-book-open'; // Default icon
    },

    buildOrderPayload() {
      return {
        name: this.customer.name,
        phone: this.customer.phone,
        items: this.cart.map(item => ({ lessonId: item._id, qty: 1 }))
      };
    },

    async sendOrder(order) {
      const response = await fetch(`${this.apiBaseUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order)
      });
      if (!response.ok) {
        throw new Error('Failed to create order.');
      }
      return response.json();
    },

    async updateLessonSpaces() {
      const updatePromises = this.cart.map(lesson => {
        return fetch(`${this.apiBaseUrl}/lessons/${lesson._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ space: lesson.space })
        });
      });
      await Promise.all(updatePromises);
    },

    handleCheckoutSuccess() {
      this.confirmation = 'Your order has been placed! Redirecting to lessons...';
      this.cart = [];
      this.customer.name = '';
      this.customer.phone = '';
      this.payment.cardNumber = '';
      this.payment.expiry = '';
      this.payment.cvc = '';

      setTimeout(() => {
        this.returnToMainPage();
      }, 3000);
    },

    returnToMainPage() {
      this.showCart = false;
      this.confirmation = '';
      this.fetchLessons();
    },

    handleCheckoutError(error) {
      this.confirmation = `Checkout failed: ${error.message}. Please refresh and try again.`;
      console.error('Checkout error:', error);
    },

    async checkout() {
      if (this.checkoutDisabled) {
        return;
      }
      if (this.isCheckingOut) {
        return;
      }

      this.isCheckingOut = true;
      this.confirmation = '';

      const order = this.buildOrderPayload();

      try {
        await this.sendOrder(order);
        await this.updateLessonSpaces();
        this.handleCheckoutSuccess();
      } catch (error) {
        this.handleCheckoutError(error);
      } finally {
        this.isCheckingOut = false;
      }
    },

    async fetchLessons() {
      try {
        const response = await fetch(`${this.apiBaseUrl}/lessons`);
        if (!response.ok) throw new Error('Failed to fetch lessons.');
        this.lessons = await response.json();
      } catch (error) {
        console.error('Fetch lessons error:', error);
      }
    },

    async fetchSearchResults() {
      const q = this.searchText.trim();
      if (!q) {
        return this.fetchLessons();
      }

      this.isSearching = true;
      try {
        const url = `${this.apiBaseUrl}/search?q=${encodeURIComponent(q)}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to search lessons.');
        const results = await response.json();
        this.lessons = results;
      } catch (error) {
        console.error('Search lessons error:', error);
      } finally {
        this.isSearching = false;
      }
    }
  },
  mounted() {
    this.fetchLessons();
  }
});
