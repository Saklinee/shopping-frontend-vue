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
    // New: fake payment details (front-end only)
    payment: {
      cardNumber: '',
      expiry: '',
      cvc: ''
    },
    confirmation: '',
    // Search text from the input
    searchText: '',
    // Flags for backend search
    isSearching: false,
    searchTimeoutId: null,
    // Flag to prevent double checkout
    isCheckingOut: false,
    // Your Render backend URL
    apiBaseUrl: 'https://shopping-backend-express.onrender.com'
  },
  computed: {
    // Sorts the lessons returned from the backend (all or search results)
    sortedLessons() {
      return [...this.lessons].sort((a, b) => {
        const modifier = this.sortDir === 'asc' ? 1 : -1;
        if (a[this.sortBy] < b[this.sortBy]) return -1 * modifier;
        if (a[this.sortBy] > b[this.sortBy]) return 1 * modifier;
        return 0;
      });
    },
    validName() {
      // Regex to allow only letters and spaces
      return /^[A-Za-z\s]+$/.test(this.customer.name);
    },
    validPhone() {
      // Regex to allow only numbers
      return /^\d+$/.test(this.customer.phone);
    },
    // New: total value of items in the cart
    cartTotal() {
      // Sum of lesson prices; adjust if you later add quantity
      return this.cart.reduce(
        (sum, item) => sum + Number(item.price || 0),
        0
      );
    },
    // New: fake card number validation (16 digits, spaces allowed)
    validCard() {
      const digits = this.payment.cardNumber.replace(/\s+/g, '');
      return /^\d{16}$/.test(digits);
    },
    // New: fake expiry validation (MM/YY, 01–12)
    validExpiry() {
      const match = /^(\d{2})\/(\d{2})$/.exec(this.payment.expiry);
      if (!match) return false;
      const month = Number(match[1]);
      return month >= 1 && month <= 12;
    },
    // New: fake CVC validation (3–4 digits)
    validCvc() {
      return /^\d{3,4}$/.test(this.payment.cvc);
    },
    // New: single place to control when checkout button is disabled
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
    // Search-as-you-type using the backend /search route
    searchText(newVal) {
      const q = newVal.trim();

      // Clear any pending search to implement debounce
      if (this.searchTimeoutId) {
        clearTimeout(this.searchTimeoutId);
      }

      // If search box is empty, reload all lessons
      this.searchTimeoutId = setTimeout(() => {
        if (!q) {
          this.fetchLessons();
        } else {
          this.fetchSearchResults();
        }
      }, 300); // 300ms debounce
    }
  },
  methods: {
    addToCart(lesson) {
      // Find the lesson in the main list to ensure we have the latest data
      const lessonInList = this.lessons.find(item => item._id === lesson._id);
      if (lessonInList && lessonInList.space > 0) {
        this.cart.push(lesson);
        // Reduce space on the client-side for immediate feedback
        lessonInList.space--;
      }
    },
    removeFromCart(index) {
      const removedItem = this.cart.splice(index, 1)[0];
      // Find the lesson in the main list and restore its space
      const lessonInList = this.lessons.find(item => item._id === removedItem._id);
      if (lessonInList) {
        lessonInList.space++;
      }
    },

    // ----- Checkout helpers -----

    buildOrderPayload() {
      // Note: payment details are NOT sent to the backend (demo only)
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
      return response.json(); // in case you want the saved order later
    },

    async updateLessonSpaces() {
      const updatePromises = this.cart.map(lesson => {
        // The space was already reduced on the client, so the server just needs to save it.
        return fetch(`${this.apiBaseUrl}/lessons/${lesson._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ space: lesson.space })
        });
      });
      await Promise.all(updatePromises);
    },

    handleCheckoutSuccess() {
      this.confirmation = 'Your order has been placed! (Demo payment processed)';
      this.cart = [];
      this.customer.name = '';
      this.customer.phone = '';
      this.payment.cardNumber = '';
      this.payment.expiry = '';
      this.payment.cvc = '';
    },

    handleCheckoutError(error) {
      this.confirmation = `Checkout failed: ${error.message}. Please refresh and try again.`;
      console.error('Checkout error:', error);
    },

    async checkout() {
      // Frontend validation (including fake payment)
      if (this.checkoutDisabled) {
        return;
      }
      if (this.isCheckingOut) {
        return; // prevent double submit
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

    // ----- Data fetching -----

    // Fetch all lessons (used on initial load and when search box is cleared)
    async fetchLessons() {
      try {
        const response = await fetch(`${this.apiBaseUrl}/lessons`);
        if (!response.ok) throw new Error('Failed to fetch lessons.');
        this.lessons = await response.json();
      } catch (error) {
        console.error('Fetch lessons error:', error);
      }
    },

    // Fetch lessons from the backend /search route
    async fetchSearchResults() {
      const q = this.searchText.trim();
      if (!q) {
        // If search text was cleared while this was queued, just load all lessons
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
    // Fetch the initial list of lessons when the app loads
    this.fetchLessons();
  }
});

