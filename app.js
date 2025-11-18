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
        apiBaseUrl: 'https://shopping-backend-express.onrender.com' // Your backend API URL
    },
    computed: {
        sortedLessons() {
            // Create a copy to avoid modifying the original array
            return [...this.lessons].sort((a, b) => {
                let modifier = this.sortDir === 'asc' ? 1 : -1;
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
        async fetchLessons() {
            try {
                const response = await fetch(`${this.apiBaseUrl}/lessons`);
                if (!response.ok) throw new Error('Failed to fetch lessons.');
                this.lessons = await response.json();
            } catch (error) {
                console.error('Fetch lessons error:', error);
            }
        }
    },
    mounted() {
        // Fetch the initial list of lessons when the app loads
        this.fetchLessons();
    }
});
