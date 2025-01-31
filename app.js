import { createApp, ref, onMounted } from 'vue'

const app = createApp({
    setup() {
        const backgroundImage = ref('')
        const notification = ref({ show: false, message: '', type: '' })
        const citySearch = ref('')
        const suggestions = ref([])

        // Fetch random background from Unsplash
        const fetchBackground = async () => {
            try {
                const response = await fetch('https://api.unsplash.com/photos/random?query=city,architecture&client_id=YOUR_UNSPLASH_API_KEY')
                const data = await response.json()
                backgroundImage.value = data.urls.regular
            } catch (error) {
                console.error('Failed to fetch background:', error)
            }
        }

        // Show notification
        const showNotification = (message, type = 'info') => {
            notification.value = {
                show: true,
                message,
                type
            }
            setTimeout(() => {
                notification.value.show = false
            }, 5000)
        }

        // Form submission
        const submitForm = async (event) => {
            // ... existing form submission logic ...
            showNotification('Podnět byl úspěšně odeslán', 'success')
        }

        onMounted(() => {
            fetchBackground()
            // ... rest of your initialization code ...
        })

        return {
            backgroundImage,
            notification,
            citySearch,
            suggestions,
            submitForm,
            showNotification
        }
    }
})

app.mount('#app')
