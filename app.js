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
    confirmation: '',
    // Search text from the input
    searchText: '',
    // Flags for backend search
    isSearching: false,
    searchTimeoutId: null,
    // Your Render backend URL
    apiBaseUrl: 'https://shopping-backend-express.onrender.com'
  },
  computed: {
    // Now only sorts; filtering is done by the backend /search route
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
    async checkout() {
      if (!this.validName || !this.validPhone || this.cart.length === 0) {
        return; // Prevent checkout if validation fails
      }

      // 1. Prepare the order payload
      const order = {
        name: this.customer.name,
        phone: this.customer.phone,
        items: this.cart.map(item => ({ lessonId: item._id, qty: 1 }))
      };

      try {
        // 2. Post the new order to the backend
        const orderResponse = await fetch(`${this.apiBaseUrl}/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(order)
        });

        if (!orderResponse.ok) throw new Error('Failed to create order.');

        // 3. Update the space for each lesson in the cart
        const updatePromises = this.cart.map(lesson => {
          // The space was already reduced on the client, so the server just needs to save it.
          return fetch(`${this.apiBaseUrl}/lessons/${lesson._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ space: lesson.space })
          });
        });

        await Promise.all(updatePromises);

        // 4. Handle success
        this.confirmation = 'Your order has been placed!';
        this.cart = []; // Clear the cart
        this.customer.name = '';
        this.customer.phone = '';
        // No need to call fetchLessons() again, as client-side data is now in sync.
      } catch (error) {
        this.confirmation = `Checkout failed: ${error.message}. Please refresh and try again.`;
        console.error('Checkout error:', error);
      }
    },
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
