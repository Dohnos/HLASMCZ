// script.js
// Inicializace EmailJS
(function() {
    emailjs.init("xjZWuwc3kvhF12tGX"); // Vložte svůj veřejný klíč z EmailJS
})();

// Globální proměnné
let municipalities = [];
let selectedMunicipality = null;
let map = null;
let marker = null;

// Přidejte tyto konstanty na začátek souboru pod existující globální proměnné
const mapLayers = {
    street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '© Esri'
    })
};

// Načtení dat obcí
async function loadMunicipalities() {
    try {
        console.log('Načítám obce...');
        const response = await fetch('obce.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        municipalities = Array.isArray(data) ? data : [];
        console.log('Načteno obcí:', municipalities.length);
        if (municipalities.length > 0) {
            populateCitySuggestions();
            initMap(municipalities[0].souradnice[0], municipalities[0].souradnice[1]);
        } else {
            showNotification('Seznam obcí je prázdný', 'error');
        }
    } catch (error) {
        console.error('Chyba při načítání obcí:', error);
        showNotification('Nepodařilo se načíst seznam obcí', 'error');
    }
}

// Add this function at the top of the file
function getSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Exact match gets highest score
    if (s1 === s2) return 1;
    // Starts with gets second highest score
    if (s2.startsWith(s1)) return 0.8;
    // Contains gets third highest score
    if (s2.includes(s1)) return 0.6;
    
    return 0;
}

// Update the populateCitySuggestions function
function populateCitySuggestions(searchTerm = '') {
    const suggestionsContainer = document.getElementById('citySuggestions');
    suggestionsContainer.innerHTML = '';
    
    if (!searchTerm) {
        suggestionsContainer.style.display = 'none';
        return;
    }

    const suggestions = municipalities
        .map(m => ({
            municipality: m,
            similarity: getSimilarity(searchTerm, m.hezkyNazev)
        }))
        .filter(item => item.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

    if (suggestions.length > 0) {
        suggestionsContainer.style.display = 'block';
        suggestions.forEach(({ municipality }) => {
            const div = document.createElement('div');
            div.className = 'city-suggestion';
            
            // Create content with municipality name and region
            const index = municipality.hezkyNazev.toLowerCase().indexOf(searchTerm.toLowerCase());
            let nameHtml;
            if (index >= 0) {
                const before = municipality.hezkyNazev.substring(0, index);
                const match = municipality.hezkyNazev.substring(index, index + searchTerm.length);
                const after = municipality.hezkyNazev.substring(index + searchTerm.length);
                nameHtml = `${before}<strong>${match}</strong>${after}`;
            } else {
                nameHtml = municipality.hezkyNazev;
            }
            
            // Add region information
            div.innerHTML = `
                <div>${nameHtml}</div>
                <small style="color: #666;">${municipality.adresaUradu.kraj}</small>
            `;
            
            div.onclick = () => selectCity(municipality);
            suggestionsContainer.appendChild(div);
        });
    } else {
        suggestionsContainer.style.display = 'none';
    }
}

// Funkce pro výběr města
function selectCity(municipality) {
    document.getElementById('cityInput').value = municipality.hezkyNazev;
    document.getElementById('citySelect').value = municipality.zkratka;
    document.getElementById('citySuggestions').style.display = 'none';
    document.querySelector('.clear-input-btn').style.display = 'block';
    selectedMunicipality = municipality;
    displayCityInfo(municipality);
}

// Přidat event listener pro input
document.getElementById('cityInput').addEventListener('input', function(e) {
    populateCitySuggestions(e.target.value);
});

// Přidat event listener pro změnu výběru
document.getElementById('cityInput').addEventListener('change', function(e) {
    const selectedName = e.target.value;
    const municipality = municipalities.find(m => m.hezkyNazev === selectedName);
    
    if (municipality) {
        document.getElementById('citySelect').value = municipality.zkratka;
        selectedMunicipality = municipality;
        displayCityInfo(municipality);
    }
});

// Zobrazení informací o vybraném městě
function displayCityInfo(municipality) {
    const cityInfo = document.getElementById('cityInfo');
    const cityAddress = document.getElementById('cityAddress');

    const address = municipality.adresaUradu;
    
    // Construct address based on available information
    let addressText = '';
    
    // Add municipality name as the first line
    addressText += `<p><strong>${municipality.nazev || municipality.hezkyNazev}</strong></p>`;
    
    // Add street address if available, otherwise use municipality name with house number
    if (address.ulice) {
        addressText += `<p>${address.ulice} ${address.cisloDomovni}${address.cisloOrientacni ? '/' + address.cisloOrientacni : ''}</p>`;
    } else {
        addressText += `<p>${municipality.hezkyNazev} ${address.cisloDomovni}</p>`;
    }
    
    // Add ZIP code and city
    addressText += `<p>${address.PSC} ${address.obec}</p>`;
    
    // Add region
    addressText += `<p>${address.kraj}</p>`;

    // Update the DOM
    cityAddress.innerHTML = addressText;
    cityAddress.classList.remove('hidden');
    cityInfo.classList.add('visible');
    
    // Set the initial address in the address input
    const fullAddress = address.ulice 
        ? `${address.ulice} ${address.cisloDomovni}${address.cisloOrientacni ? '/' + address.cisloOrientacni : ''}, ${address.PSC} ${address.obec}`
        : `${municipality.hezkyNazev} ${address.cisloDomovni}, ${address.PSC} ${address.obec}`;
    document.getElementById('address').value = fullAddress;

    if (municipality.souradnice && municipality.souradnice.length === 2) {
        initMap(municipality.souradnice[0], municipality.souradnice[1]);
        updateLocationInfo(municipality.souradnice[0], municipality.souradnice[1]);
    } else {
        console.error('Chybí souřadnice pro:', municipality.hezkyNazev);
    }
}

// Inicializace mapy (předpokládá použití např. Leaflet.js)
function initMap(lat, lng) {
    console.log('Inicializace mapy:', lat, lng);
    if (map) {
        map.remove();
    }
    
    try {
        map = L.map('map', {
            center: [lat, lng],
            zoom: 13,
            dragging: false,  // Disable map dragging
            touchZoom: false, // Disable touch zoom
            scrollWheelZoom: false // Disable scroll zoom
        });

        // Přidání výchozí vrstvy
        mapLayers.street.addTo(map);

        // Přidání přepínače vrstev
        const mapTypeSwitch = L.control({position: 'topright'});
        mapTypeSwitch.onAdd = function() {
            const container = L.DomUtil.create('div', 'map-type-switch');
            container.innerHTML = `
                <button type="button" class="street-view active">Mapa</button>
                <button type="button" class="satellite-view">Satelit</button>
            `;
            
            // Přepínání vrstev
            container.querySelector('.street-view').onclick = function() {
                map.removeLayer(mapLayers.satellite);
                map.addLayer(mapLayers.street);
                this.classList.add('active');
                container.querySelector('.satellite-view').classList.remove('active');
            };
            
            container.querySelector('.satellite-view').onclick = function() {
                map.removeLayer(mapLayers.street);
                map.addLayer(mapLayers.satellite);
                this.classList.add('active');
                container.querySelector('.street-view').classList.remove('active');
            };
            
            return container;
        };
        mapTypeSwitch.addTo(map);

        marker = L.marker([lat, lng]).addTo(map);
        
        // Add click handler to open modal
        map.on('click', () => {
            showMapModal(lat, lng);
        });

        // Add instruction overlay
        const mapContainer = document.getElementById('map');
        const instruction = document.createElement('div');
        instruction.className = 'map-overlay';
        instruction.innerHTML = `
            <div class="map-overlay-content">
                <i class="fas fa-map-marker-alt"></i>
                Klikněte pro výběr přesného místa
            </div>
        `;
        mapContainer.appendChild(instruction);

    } catch (error) {
        console.error('Chyba při inicializaci mapy:', error);
    }
}

// Update showMapModal function's preConfirm and add updateMainMap function
function showMapModal(lat, lng) {
    const isMobile = window.innerWidth <= 768;
    
    Swal.fire({
        title: '<i class="fas fa-map-marked-alt"></i> Vyberte přesné místo',
        html: `
            <p class="modal-subtitle">
                <i class="fas fa-exclamation-circle"></i>
                Níže zadáte upřesnění místa!
            </p>
            <div class="modal-current-address">
                <i class="fas fa-location-dot"></i>
                <span id="modalAddress">${document.getElementById('address').value || 'Vyberte místo na mapě...'}</span>
            </div>
            <div class="address-input-container">
                <input type="text" id="modalAddressInput" class="modal-address-input" 
                    placeholder="Zadejte adresu nebo vyberte místo na mapě"
                    value="${document.getElementById('address').value}">
                <div class="address-actions-container">
                    <button type="button" class="find-address-btn" title="Hledat adresu">
                        <i class="fas fa-search"></i>
                    </button>
                    <button type="button" class="clear-address-btn" title="Vymazat adresu">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
            <div id="modalMap" style="height: 400px; width: 100%; margin: 1rem 0;"></div>
            <div class="location-details">
                <input type="text" id="modalLocationDetail" 
                    placeholder="Upřesněte místo (např. 'lampa č. 123', 'před vchodem', apod.)" 
                    maxlength="100"
                    value="${document.getElementById('locationDetail').value}">
                <div class="detail-hint">Pomůže nám to místo lépe identifikovat</div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: isMobile ? 'Potvrdit' : '<i class="fas fa-check"></i> Potvrdit',
        cancelButtonText: isMobile ? 'Zrušit' : '<i class="fas fa-times"></i> Zrušit',
        customClass: {
            popup: 'map-modal-popup',
            confirmButton: 'custom-confirm-button',
            cancelButton: 'custom-cancel-button',
            actions: 'map-modal-actions'
        },
        grow: isMobile ? 'fullscreen' : false,
        width: isMobile ? '100%' : '800px',
        padding: isMobile ? '0' : '2rem',
        didOpen: () => {
            // Disable confirm button initially if no address is set
            const confirmButton = Swal.getConfirmButton();
            confirmButton.disabled = !document.getElementById('modalAddressInput').value;

            // Add observer for address changes
            const addressObserver = new MutationObserver(() => {
                const hasAddress = document.getElementById('modalAddressInput').value;
                confirmButton.disabled = !hasAddress;
            });

            addressObserver.observe(document.getElementById('modalAddress'), { 
                characterData: true, 
                childList: true, 
                subtree: true 
            });

            setTimeout(() => {
                const modalMap = L.map('modalMap').setView([lat, lng], 15);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    maxZoom: 19,
                    attribution: '© OpenStreetMap contributors'
                }).addTo(modalMap);

                const modalMarker = L.marker([lat, lng], { draggable: true }).addTo(modalMap);
                
                const updateAddressDisplays = (address) => {
                    document.getElementById('modalAddressInput').value = address;
                    document.getElementById('modalAddress').textContent = address;
                    document.getElementById('address').value = address;
                };

                const updateModalAddress = async (lat, lng) => {
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                        const data = await response.json();
                        const address = data.display_name;
                        updateAddressDisplays(address);
                    } catch (error) {
                        console.error('Chyba při získávání adresy:', error);
                    }
                };

                updateModalAddress(lat, lng);
                
                modalMap.on('click', (e) => {
                    modalMarker.setLatLng(e.latlng);
                    updateLocationInfo(e.latlng.lat, e.latlng.lng);
                    updateModalAddress(e.latlng.lat, e.latlng.lng);
                });

                modalMarker.on('dragend', (e) => {
                    const pos = e.target.getLatLng();
                    updateLocationInfo(pos.lat, pos.lng);
                    updateModalAddress(pos.lat, pos.lng);
                });

                // Add search by address functionality
                const addressInput = document.querySelector('#modalAddressInput');
                const findAddressBtn = document.querySelector('.find-address-btn');

                const searchAddress = async () => {
                    const address = addressInput.value;
                    if (!address) return;

                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
                        const data = await response.json();
                        
                        if (data && data.length > 0) {
                            const location = data[0];
                            const newLat = parseFloat(location.lat);
                            const newLng = parseFloat(location.lon);
                            
                            modalMarker.setLatLng([newLat, newLng]);
                            modalMap.setView([newLat, newLng], 17);
                            updateLocationInfo(newLat, newLng);
                            updateAddressDisplays(location.display_name);
                        } else {
                            showNotification('Adresa nenalezena', 'error');
                        }
                    } catch (error) {
                        console.error('Chyba při hledání adresy:', error);
                        showNotification('Chyba při hledání adresy', 'error');
                    }
                };

                findAddressBtn.addEventListener('click', searchAddress);
                addressInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        searchAddress();
                    }
                });

                // Add clear address functionality
                const clearAddressBtn = document.querySelector('.clear-address-btn');
                clearAddressBtn.addEventListener('click', () => {
                    updateAddressDisplays('');
                    document.querySelector('#modalAddress').textContent = 'Vyberte místo na mapě...';
                });

                // Update input handlers
                const modalAddressInput = document.getElementById('modalAddressInput');
                modalAddressInput.addEventListener('input', (e) => {
                    document.getElementById('modalAddress').textContent = e.target.value || 'Vyberte místo na mapě...';
                });

                // Přidání výchozí vrstvy
                mapLayers.street.addTo(modalMap);

                // Přidání přepínače vrstev
                const mapTypeSwitch = L.control({position: 'topright'});
                mapTypeSwitch.onAdd = function() {
                    const container = L.DomUtil.create('div', 'map-type-switch');
                    container.innerHTML = `
                        <button type="button" class="street-view active">Mapa</button>
                        <button type="button" class="satellite-view">Let</button>
                    `;
                    
                    // Přepínání vrstev
                    container.querySelector('.street-view').onclick = function() {
                        modalMap.removeLayer(mapLayers.satellite);
                        modalMap.addLayer(mapLayers.street);
                        this.classList.add('active');
                        container.querySelector('.satellite-view').classList.remove('active');
                    };
                    
                    container.querySelector('.satellite-view').onclick = function() {
                        modalMap.removeLayer(mapLayers.street);
                        modalMap.addLayer(mapLayers.satellite);
                        this.classList.add('active');
                        container.querySelector('.street-view').classList.remove('active');
                    };
                    
                    return container;
                };
                mapTypeSwitch.addTo(modalMap);
            }, 300);
        },
        preConfirm: () => {
            // Transfer the modal location detail to the main form
            const modalDetail = document.getElementById('modalLocationDetail');
            const mainDetail = document.getElementById('locationDetail');
            if (modalDetail && mainDetail) {
                mainDetail.value = modalDetail.value;
            }
            
            // Update the main map display
            updateMainMap(lat, lng);
            return true;
        }
    });
}

// Add new function to update main map display
function updateMainMap(lat, lng) {
    if (map) {
        map.remove();
    }
    
    try {
        map = L.map('map', {
            center: [lat, lng],
            zoom: 15,
            dragging: false,
            touchZoom: false,
            scrollWheelZoom: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        marker = L.marker([lat, lng]).addTo(map);
        
        // Add click handler to open modal
        map.on('click', () => {
            showMapModal(lat, lng);
        });

        // Update the map container with selected address
        const mapContainer = document.getElementById('map');
        const existingOverlay = mapContainer.querySelector('.map-overlay');
        if (existingOverlay) {
            existingOverlay.remove();
        }

        const overlay = document.createElement('div');
        overlay.className = 'map-overlay map-overlay-confirmed';
        
        overlay.innerHTML = `
            <div class="map-overlay-content confirmed">
                <div class="location-status">
                    <i class="fas fa-check-circle"></i>
                    <span>Adresa zadána</span>
                </div>
                <div class="location-actions">
                    <button type="button" class="action-btn edit-btn" title="Upravit adresu">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="action-btn delete-btn" title="Vymazat adresu">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;

        // Add click handlers
        overlay.querySelector('.edit-btn').addEventListener('click', () => {
            showMapModal(lat, lng);
        });

        overlay.querySelector('.delete-btn').addEventListener('click', () => {
            document.getElementById('address').value = '';
            document.getElementById('coordinates').value = '';
            document.getElementById('locationDetail').value = '';
            initMap(lat, lng); // Reset map to initial state
        });

        mapContainer.appendChild(overlay);
    } catch (error) {
        console.error('Chyba při inicializaci mapy:', error);
    }
}

// Aktualizace informací o lokaci
async function updateLocationInfo(lat, lng) {
    document.getElementById('coordinates').value = `${lat}, ${lng}`;
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        document.getElementById('address').value = data.display_name;
    } catch (error) {
        console.error('Chyba při získávání adresy:', error);
    }
}

// Přidání event listeneru pro kliknutí na mapu
function addMapClickListener() {
    map.on('click', function(e) {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        updateLocationInfo(lat, lng);
    });
}

// Add category mapping
const categoryTranslations = {
    'infrastruktura': 'Infrastruktura',
    'zivotni-prostredi': 'Životní prostředí',
    'bezpecnost': 'Bezpečnost',
    'uklid': 'Úklid',
    'osvetleni': 'Osvětlení',
    'ostatni': 'Ostatní'
};

// Generate a unique ticket ID (you can use your own format)
const ticketId = `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Format current date
const formattedDate = new Date().toLocaleString('cs-CZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
});

// Spam protection logic
function generateMathPuzzle() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    return {
        question: `${num1} + ${num2} = ?`,
        answer: num1 + num2
    };
}

// Form validation
function validateForm() {
    const requiredFields = {
        'citySelect': 'Vyberte město/obec',
        'category': 'Vyberte kategorii',
        'description': 'Zadejte popis podnětu',
        'coordinates': 'Vyberte lokaci na mapě',
        'address': 'Adresa je povinná'
    };

    for (const [fieldId, errorMessage] of Object.entries(requiredFields)) {
        const field = document.getElementById(fieldId);
        if (!field.value.trim()) {
            showNotification(errorMessage, 'error');
            return false;
        }
    }

    // Check if either anonymous is checked or a valid email is provided
    const anonymousChecked = document.getElementById('anonymousToggle').checked;
    const contactEmail = document.getElementById('contact').value;
    if (!anonymousChecked && !isValidEmail(contactEmail)) {
        showNotification('Zadejte platnou e-mailovou adresu nebo zaškrtněte "Odeslat anonymně"', 'error');
        return false;
    }

    return true;
}

// Add email validation function
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Zpracování formuláře
document.getElementById('reportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }

    // Email validation
    const contactEmail = document.getElementById('contact').value;
    if (contactEmail && !isValidEmail(contactEmail)) {
        showNotification('Zadejte platnou e-mailovou adresu', 'error');
        return;
    }

    const municipality = municipalities.find(m => m.zkratka === document.getElementById('citySelect').value);
    if (!municipality) {
        showNotification('Město nebylo nalezeno', 'error');
        return;
    }

    // Create location URL
    const coords = document.getElementById('coordinates').value.split(',').map(x => x.trim());
    const locationUrl = `https://www.openstreetmap.org/?mlat=${coords[0]}&mlon=${coords[1]}#map=17/${coords[0]}/${coords[1]}`;

    const locationDetail = document.getElementById('locationDetail').value;
    
    // Update confirmation dialog to include location detail
    const confirmResult = await Swal.fire({
        title: '<i class="fas fa-clipboard-check"></i> Potvrzení údajů',
        html: `
            <div class="confirmation-dialog">
                <div class="confirmation-details">
                    <p><i class="fas fa-city"></i> <strong>${municipality.hezkyNazev}</strong></p>
                    <p><i class="fas fa-map"></i> <strong>${municipality.adresaUradu.kraj}</strong></p>
                    <p><i class="fas fa-envelope"></i> <strong>${municipality.mail[0]}</strong></p>
                    <p><i class="fas fa-map-marker-alt"></i> <a href="${locationUrl}" target="_blank">Zobrazit místo na mapě <i class="fas fa-external-link-alt"></i></a></p>
                    ${locationDetail ? `<p><i class="fas fa-info-circle"></i> <strong>${locationDetail}</strong></p>` : ''}
                    ${contactEmail ? `<p><i class="fas fa-at"></i> ${contactEmail}</p>` : ''}
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-check"></i>',
        cancelButtonText: '<i la class="fas fa-edit"></i>',
        reverseButtons: true,
        customClass: {
            popup: 'custom-popup',
            content: 'custom-content',
            confirmButton: 'custom-confirm-button',
            cancelButton: 'custom-cancel-button',
            actions: 'confirmation-dialog-actions'
        }
    });

    if (!confirmResult.isConfirmed) {
        return;
    }

    // Continue with the math puzzle and form submission
    const puzzle = generateMathPuzzle();
    const userAnswer = await Swal.fire({
        title: 'Ověření',
        text: `Pro odeslání vyřešte příklad: ${puzzle.question}`,
        input: 'number',
        inputPlaceholder: 'Zadejte výsledek',
        showCancelButton: true,
        cancelButtonText: 'Zrušit',
        confirmButtonText: 'Odeslat',
        customClass: {
            popup: 'verification-modal',
            input: 'swal2-input'
        },
        inputValidator: (value) => {
            if (!value || parseInt(value) !== puzzle.answer) {
                return 'Nesprávná odpověď, zkuste to znovu';
            }
        }
    });

    if (!userAnswer.isConfirmed) {
        return;
    }

    showNotification('Odesílám podnět...', 'info');

    try {
        const formData = {
            city: document.getElementById('citySelect').value,
            category: document.getElementById('category').value,
            description: document.getElementById('description').value,
            coordinates: document.getElementById('coordinates').value,
            address: document.getElementById('address').value,
            contact: document.getElementById('contact').value,
            locationDetail: document.getElementById('locationDetail').value || ''
        };

        const municipality = municipalities.find(m => m.zkratka === formData.city);
        if (!municipality) {
            throw new Error('Město nebylo nalezeno');
        }

        // Vytvoření přesnějšího odkazu na mapu s označeným bodem
        const [lat, lon] = formData.coordinates.split(',').map(coord => coord.trim());
        const preciseMapLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=19#map=19/${lat}/${lon}`;

        const emailData = {
            to_name: municipality.hezkyNazev,
            to_email: municipality.mail[0],
            from_email: formData.contact || 'Anonymní',
            category: categoryTranslations[formData.category] || formData.category,
            description: formData.description,
            location_coords: formData.coordinates,
            location_address: formData.address,
            maps_link: preciseMapLink, // Použijeme přesnější odkaz
            locationDetail: formData.locationDetail,
            created_at: formattedDate,
            ticket_id: ticketId
        };

        await emailjs.send("service_frm7yih", "template_j65csao", emailData);
        
        showNotification('Podnět byl úspěšně odeslán', 'success');
        e.target.reset();
        document.getElementById('cityInfo').classList.remove('visible');
        document.getElementById('citySuggestions').style.display = 'none';
    } catch (error) {
        console.error('Chyba při odesílání:', error);
        showNotification('Nepodařilo se odeslat podnět: ' + error.message, 'error');
    }
});

// Add anonymous submission handling
document.getElementById('anonymousToggle').addEventListener('change', function(e) {
    const contactGroup = document.getElementById('contactGroup');
    if (e.target.checked) {
        contactGroup.style.display = 'none';
        document.getElementById('contact').value = '';
    } else {
        contactGroup.style.display = 'block';
    }
});

// Update the showNotification function
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification-${type}`;
    notification.innerHTML = `
        <div>${message}</div>
        <div class="progress-bar">
            <div class="progress-bar-fill"></div>
        </div>
    `;
    
    // Remove any existing notifications
    const existingNotification = document.querySelector('.notification-success, .notification-error, .notification-info');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    document.body.appendChild(notification);
    
    // Start progress bar animation
    const progressBar = notification.querySelector('.progress-bar-fill');
    progressBar.style.width = '0%';
    setTimeout(() => {
        progressBar.style.width = '100%';
    }, 100);
    
    // Remove notification after animation
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Event listener pro změnu města
document.getElementById('citySelect').addEventListener('change', function(e) {
    const selectedCity = e.target.value;
    const municipality = municipalities.find(m => m.zkratka === selectedCity);
    if (municipality) {
        selectedMunicipality = municipality;
        displayCityInfo(municipality);
    }
});

// Add city input clear functionality
document.addEventListener('DOMContentLoaded', function() {
    const cityInput = document.getElementById('cityInput');
    const clearBtn = document.querySelector('.clear-input-btn');
    const cityInfo = document.getElementById('cityInfo');

    // Show/hide clear button based on input content
    function toggleClearButton() {
        if (cityInput.value) {
            clearBtn.style.display = 'block';
        } else {
            clearBtn.style.display = 'none';
            cityInfo.classList.remove('visible');
        }
    }

    // Initialize clear button state
    toggleClearButton();

    // Handle input changes
    cityInput.addEventListener('input', function() {
        toggleClearButton();
        if (!this.value) {
            cityInfo.classList.remove('visible');
        }
    });

    // Clear button click handler
    clearBtn.addEventListener('click', function() {
        cityInput.value = '';
        document.getElementById('citySelect').value = '';
        document.getElementById('address').value = ''; // Clear the address input
        cityInfo.classList.remove('visible');
        document.getElementById('citySuggestions').style.display = 'none';
        toggleClearButton();
    });
});

// Načtení dat při startu aplikace
document.addEventListener('DOMContentLoaded', loadMunicipalities);