// Feedback Form V2 - Dynamic Form Switching

const API_BASE = window.location.origin;
let currentFormType = 'driver';
let featureFlags = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadFeatureFlags();
    renderNavigation();
    loadForm('driver');
    
    // Poll for feature flag changes every 10 seconds
    setInterval(loadFeatureFlags, 10000);
});

// Load feature flags from API
async function loadFeatureFlags() {
    try {
        const response = await fetch(`${API_BASE}/api/config/features`);
        const data = await response.json();
        featureFlags = data.features;
        renderNavigation();
    } catch (error) {
        console.error('Error loading feature flags:', error);
        // Fallback to all enabled
        featureFlags = { driver: true, trip: true, mobile: true, marshal: true };
    }
}

// Render navigation based on feature flags
function renderNavigation() {
    const nav = document.getElementById('feedbackNav');
    nav.innerHTML = '';
    
    const types = [
        { key: 'driver', label: 'Driver' },
        { key: 'trip', label: 'Trip' },
        { key: 'mobile', label: 'Mobile' },
        { key: 'marshal', label: 'Marshal' }
    ];
    
    types.forEach(type => {
        if (featureFlags[type.key]) {
            const link = document.createElement('button');
            link.className = `nav-link ${currentFormType === type.key ? 'active' : ''}`;
            link.setAttribute('data-type', type.key);
            link.textContent = type.label;
            link.onclick = () => switchForm(type.key);
            nav.appendChild(link);
        }
    });
    
    // If current form is disabled, switch to first available
    if (!featureFlags[currentFormType]) {
        const firstEnabled = types.find(t => featureFlags[t.key]);
        if (firstEnabled) {
            switchForm(firstEnabled.key);
        }
    }
}

// Switch between forms
function switchForm(type) {
    if (!featureFlags[type]) return;
    
    currentFormType = type;
    renderNavigation();
    loadForm(type);
}

// Load form based on type
function loadForm(type) {
    const container = document.getElementById('formContainer');
    const loadingState = document.getElementById('loadingState');
    
    // Hide loading, show container
    loadingState.style.display = 'none';
    
    // Remove all existing forms
    container.querySelectorAll('.form-panel').forEach(panel => {
        panel.classList.remove('active');
        panel.remove();
    });
    
    // Create and show appropriate form
    const formPanel = document.createElement('div');
    formPanel.className = 'form-panel active';
    formPanel.setAttribute('data-type', type);
    formPanel.innerHTML = getFormHTML(type);
    container.setAttribute('data-type', type);
    container.appendChild(formPanel);
    
    // Attach form handler
    const form = formPanel.querySelector('form');
    if (form) {
        form.addEventListener('submit', (e) => handleSubmit(e, type));
    }
}

// Get form HTML based on type
function getFormHTML(type) {
    const forms = {
        driver: getDriverForm(),
        trip: getTripForm(),
        mobile: getMobileForm(),
        marshal: getMarshalForm()
    };
    
    return forms[type] || forms.driver;
}

// Driver Feedback Form
function getDriverForm() {
    return `
        <div class="form-header" data-type="driver">
            <h2>Driver Feedback</h2>
            <p>Share your experience with the driver</p>
        </div>
        <form class="feedback-form" id="driverForm">
            <div class="form-group required">
                <label for="driverId">Driver ID</label>
                <input type="text" id="driverId" name="driverId" required placeholder="e.g., driver_001">
            </div>
            
            <div class="form-group">
                <label for="driverName">Driver Name</label>
                <input type="text" id="driverName" name="driverName" placeholder="Optional">
            </div>
            
            <div class="form-group">
                <label for="tripId">Trip ID</label>
                <input type="text" id="tripId" name="tripId" placeholder="e.g., trip_001">
            </div>
            
            <div class="form-group required">
                <label for="driverComment">Your Feedback</label>
                <textarea id="driverComment" name="comment" rows="5" required 
                    placeholder="Share your experience with the driver..."></textarea>
            </div>
            
            <div class="submit-section">
                <button type="submit" class="submit-btn">Submit Feedback</button>
            </div>
        </form>
    `;
}

// Trip Feedback Form
function getTripForm() {
    return `
        <div class="form-header" data-type="trip">
            <h2>Trip Feedback</h2>
            <p>Share your experience about the trip</p>
        </div>
        <form class="feedback-form" id="tripForm">
            <div class="form-group required">
                <label for="tripId_trip">Trip ID</label>
                <input type="text" id="tripId_trip" name="tripId" required placeholder="e.g., trip_001">
            </div>
            
            <div class="form-group required">
                <label for="driverId_trip">Driver ID</label>
                <input type="text" id="driverId_trip" name="driverId" required placeholder="e.g., driver_001">
            </div>
            
            <div class="form-group">
                <label for="origin">Origin</label>
                <input type="text" id="origin" name="origin" placeholder="Starting location">
            </div>
            
            <div class="form-group">
                <label for="destination">Destination</label>
                <input type="text" id="destination" name="destination" placeholder="Ending location">
            </div>
            
            <div class="form-group required">
                <label for="tripComment">Your Feedback</label>
                <textarea id="tripComment" name="comment" rows="5" required 
                    placeholder="Share your trip experience..."></textarea>
            </div>
            
            <div class="submit-section">
                <button type="submit" class="submit-btn">Submit Feedback</button>
            </div>
        </form>
    `;
}

// Mobile App Feedback Form
function getMobileForm() {
    return `
        <div class="form-header" data-type="mobile">
            <h2>Mobile App Feedback</h2>
            <p>Share your experience with the mobile application</p>
        </div>
        <form class="feedback-form" id="mobileForm">
            <div class="form-group">
                <label for="deviceType">Device Type</label>
                <select id="deviceType" name="deviceType">
                    <option value="">Select device type</option>
                    <option value="iOS">iOS</option>
                    <option value="Android">Android</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>Features Used</label>
                <div class="checkbox-group">
                    <div class="checkbox-item">
                        <input type="checkbox" id="booking" name="features" value="booking">
                        <label for="booking">Booking</label>
                    </div>
                    <div class="checkbox-item">
                        <input type="checkbox" id="navigation" name="features" value="navigation">
                        <label for="navigation">Navigation</label>
                    </div>
                    <div class="checkbox-item">
                        <input type="checkbox" id="payment" name="features" value="payment">
                        <label for="payment">Payment</label>
                    </div>
                    <div class="checkbox-item">
                        <input type="checkbox" id="tracking" name="features" value="tracking">
                        <label for="tracking">Tracking</label>
                    </div>
                </div>
            </div>
            
            <div class="form-group required">
                <label for="mobileComment">Your Feedback</label>
                <textarea id="mobileComment" name="comment" rows="5" required 
                    placeholder="Share your app experience..."></textarea>
            </div>
            
            <div class="submit-section">
                <button type="submit" class="submit-btn">Submit Feedback</button>
            </div>
        </form>
    `;
}

// Marshal Feedback Form
function getMarshalForm() {
    return `
        <div class="form-header" data-type="marshal">
            <h2>Marshal Feedback</h2>
            <p>Share your experience with marshal services</p>
        </div>
        <form class="feedback-form" id="marshalForm">
            <div class="form-group required">
                <label for="marshalId">Marshal ID</label>
                <input type="text" id="marshalId" name="marshalId" required placeholder="e.g., marshal_001">
            </div>
            
            <div class="form-group">
                <label for="location">Location/Station</label>
                <input type="text" id="location" name="location" placeholder="e.g., Station A">
            </div>
            
            <div class="form-group">
                <label for="serviceType">Service Type</label>
                <select id="serviceType" name="serviceType">
                    <option value="">Select service type</option>
                    <option value="safety">Safety</option>
                    <option value="assistance">Assistance</option>
                    <option value="information">Information</option>
                    <option value="other">Other</option>
                </select>
            </div>
            
            <div class="form-group required">
                <label for="marshalComment">Your Feedback</label>
                <textarea id="marshalComment" name="comment" rows="5" required 
                    placeholder="Share your marshal service experience..."></textarea>
            </div>
            
            <div class="submit-section">
                <button type="submit" class="submit-btn">Submit Feedback</button>
            </div>
        </form>
    `;
}

// Handle form submission
async function handleSubmit(e, type) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Collect form data
    const data = {
        type: type === 'mobile' ? 'mobile' : type, // Send 'mobile' to API
        comment: formData.get('comment'),
    };
    
    // Add required fields based on type
    if (type === 'driver') {
        data.driverId = formData.get('driverId');
        data.tripId = formData.get('tripId') || null;
        data.metadata = {
            driverName: formData.get('driverName') || null,
        };
    } else if (type === 'trip') {
        data.driverId = formData.get('driverId');
        data.tripId = formData.get('tripId');
        data.metadata = {
            origin: formData.get('origin') || null,
            destination: formData.get('destination') || null,
        };
    } else if (type === 'mobile') {
        data.driverId = null; // Mobile doesn't need driver
        data.metadata = {
            deviceType: formData.get('deviceType') || null,
            features: formData.getAll('features'),
        };
    } else if (type === 'marshal') {
        data.driverId = null; // Marshal doesn't need driver
        data.metadata = {
            marshalId: formData.get('marshalId'),
            location: formData.get('location') || null,
            serviceType: formData.get('serviceType') || null,
        };
    }
    
    // Show loading toast
    showToast('Submitting feedback...', 'info');
    
    try {
        const response = await fetch(`${API_BASE}/feedback`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Show success toast
            showToast('✅ Feedback submitted successfully!', 'success');
            
            // Reset form
            form.reset();
        } else {
            showToast(`❌ Error: ${result.error || 'Failed to submit feedback'}`, 'error');
        }
    } catch (error) {
        showToast(`❌ Network error: ${error.message}`, 'error');
    }
}

// Toast notification system
function showToast(message, type = 'info') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Add to page
    document.body.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

