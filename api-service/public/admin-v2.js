// Admin Dashboard V2 - Complete Implementation

const API_BASE = window.location.origin;
let charts = {};
let currentPage = 'home';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (requireAuth()) {
        loadFeatureFlags();
        loadHomePage();
        setInterval(() => {
            if (currentPage === 'home') loadHomePage();
            else refreshPage(currentPage);
        }, 30000); // Auto-refresh every 30 seconds
    }
});

// Navigation
function navigateTo(page) {
    currentPage = page;
    
    // Update sidebar
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    
    // Show selected page
    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // Load page content
        if (page === 'home') {
            loadHomePage();
        } else if (page === 'alerts') {
            loadAlertsPage();
        } else {
            loadAnalyticsPage(page);
        }
    }
}

// Load feature flags
async function loadFeatureFlags() {
    try {
        const response = await fetch(`${API_BASE}/api/config/features`);
        const data = await response.json();
        
        // Update checkboxes
        document.getElementById('flag-driver').checked = data.features.driver;
        document.getElementById('flag-trip').checked = data.features.trip;
        document.getElementById('flag-mobile').checked = data.features.mobile;
        document.getElementById('flag-marshal').checked = data.features.marshal;
        
        // Update status
        updateFlagStatus('driver', data.features.driver);
        updateFlagStatus('trip', data.features.trip);
        updateFlagStatus('mobile', data.features.mobile);
        updateFlagStatus('marshal', data.features.marshal);
    } catch (error) {
        console.error('Error loading feature flags:', error);
    }
}

// Update flag status display
function updateFlagStatus(type, enabled) {
    const statusEl = document.getElementById(`status-${type}`);
    if (statusEl) {
        statusEl.textContent = enabled ? 'Enabled' : 'Disabled';
        statusEl.classList.toggle('disabled', !enabled);
    }
}

// Toggle feature flag
async function toggleFeature(type, enabled) {
    try {
        const response = await fetch(`${API_BASE}/api/config/features`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                features: {
                    [type]: enabled
                }
            }),
        });
        
        const data = await response.json();
        if (response.ok) {
            updateFlagStatus(type, enabled);
            // Show success feedback
            console.log(`Feature ${type} ${enabled ? 'enabled' : 'disabled'}`);
        } else {
            // Revert checkbox
            document.getElementById(`flag-${type}`).checked = !enabled;
            alert('Failed to update feature flag');
        }
    } catch (error) {
        console.error('Error toggling feature:', error);
        document.getElementById(`flag-${type}`).checked = !enabled;
        alert('Error updating feature flag');
    }
}

// Load home page
async function loadHomePage() {
    try {
        // Load overview analytics
        const [analyticsRes, driversRes] = await Promise.all([
            fetch(`${API_BASE}/api/analytics/feedback?limit=1000`),
            fetch(`${API_BASE}/api/drivers/scores`)
        ]);
        
        if (!analyticsRes.ok || !driversRes.ok) {
            throw new Error('Failed to fetch analytics data');
        }
        
        const analyticsData = await analyticsRes.json();
        const driversData = await driversRes.json();
        
        // Update statistics
        updateOverviewStats(analyticsData.statistics || {}, driversData.drivers || []);
        
        // Update charts
        if (analyticsData.statistics && analyticsData.statistics.byType) {
            updateFeedbackByTypeChart(analyticsData.statistics.byType);
        }
        
        if (analyticsData.feedback && Array.isArray(analyticsData.feedback)) {
            updateSentimentTrendsChart(analyticsData.feedback);
            updateRecentFeedback(analyticsData.feedback.slice(0, 10));
        }
        
    } catch (error) {
        console.error('Error loading home page:', error);
        showToast(`Error loading dashboard: ${error.message}`, 'error');
        
        // Log detailed error for debugging
        console.error('Analytics response:', analyticsRes);
        console.error('Drivers response:', driversRes);
    }
}

// Update overview statistics
function updateOverviewStats(stats, drivers) {
    const totalEl = document.getElementById('totalFeedback');
    const avgSentimentEl = document.getElementById('avgSentiment');
    const activeDriversEl = document.getElementById('activeDrivers');
    const totalTripsEl = document.getElementById('totalTrips');
    const marshalServicesEl = document.getElementById('marshalServices');
    const mobileFeedbacksEl = document.getElementById('mobileFeedbacks');
    
    if (totalEl) totalEl.textContent = stats.total || 0;
    
    if (avgSentimentEl) {
        const avgSentiment = formatScore(stats.averageSentiment || 0);
        avgSentimentEl.textContent = avgSentiment.text;
    }
    
    if (activeDriversEl) activeDriversEl.textContent = stats.uniqueDrivers || drivers.length || 0;
    if (totalTripsEl) totalTripsEl.textContent = stats.uniqueTrips || 0;
    
    if (marshalServicesEl) {
        const marshalCount = stats.byType?.marshal || 0;
        marshalServicesEl.textContent = marshalCount;
    }
    
    if (mobileFeedbacksEl) {
        // Mobile feedbacks are stored as 'mobile' in byType (normalized from 'app' in backend)
        const mobileCount = stats.byType?.mobile || stats.byType?.app || 0;
        mobileFeedbacksEl.textContent = mobileCount;
    }
}

// Format score
function formatScore(score) {
    return {
        text: score.toFixed(2),
        class: score >= 3.5 ? 'good' : score >= 2.5 ? 'warning' : 'danger'
    };
}

// Update feedback by type chart
function updateFeedbackByTypeChart(byType) {
    const ctx = document.getElementById('feedbackByTypeChart');
    if (!ctx) return;
    
    if (!byType || typeof byType !== 'object') {
        return;
    }
    
    const labels = Object.keys(byType);
    const data = Object.values(byType);
    
    if (charts.feedbackByType) {
        charts.feedbackByType.destroy();
    }
    
    if (labels.length === 0 || data.length === 0) {
        return;
    }
    
    // Color mapping for feedback types
    const colorMap = {
        'driver': '#3B82F6',   // Blue
        'trip': '#10B981',     // Green
        'mobile': '#F59E0B',    // Amber
        'app': '#F59E0B',       // Amber (same as mobile)
        'marshal': '#EF4444'    // Red
    };
    
    const backgroundColors = labels.map(label => {
        const lowerLabel = label.toLowerCase();
        return colorMap[lowerLabel] || '#8B5CF6'; // Default purple
    });
    
    charts.feedbackByType = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 3,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                }
            }
        }
    });
}

// Update sentiment trends chart
function updateSentimentTrendsChart(feedback) {
    const ctx = document.getElementById('sentimentTrendsChart');
    if (!ctx) return;
    
    if (!feedback || feedback.length === 0) {
        return;
    }
    
    // Get last 20 feedback entries for trend
    const recentFeedback = feedback.slice(0, 20).reverse();
    
    const labels = recentFeedback.map((item, index) => {
        const date = item.processed_at || item.timestamp;
        if (date) {
            return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        return `#${index + 1}`;
    });
    
    const sentimentData = recentFeedback.map(item => item.sentiment_score || 0);
    
    if (charts.sentimentTrends) {
        charts.sentimentTrends.destroy();
    }
    
    charts.sentimentTrends = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Sentiment Score',
                data: sentimentData,
                borderColor: '#10B981', // Green
                backgroundColor: 'rgba(16, 185, 129, 0.1)', // Light green fill
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#10B981',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#059669',
                pointHoverBorderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 12,
                            weight: '600'
                        },
                        padding: 15
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 5,
                    ticks: {
                        font: {
                            size: 11,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: '#f0f0f0'
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 11,
                            weight: '600'
                        }
                    },
                    grid: {
                        color: '#f0f0f0'
                    }
                }
            }
        }
    });
}

// Update recent feedback
function updateRecentFeedback(feedback) {
    const container = document.getElementById('recentFeedbackList');
    if (!container) return;
    
    if (!feedback || feedback.length === 0) {
        container.innerHTML = '<p class="loading">No feedback yet</p>';
        return;
    }
    
    // Color mapping for feedback types
    const typeColors = {
        'driver': '#3B82F6',   // Blue
        'trip': '#10B981',     // Green
        'mobile': '#F59E0B',    // Amber
        'app': '#F59E0B',       // Amber
        'marshal': '#EF4444',   // Red
        'unknown': '#8B5CF6'    // Purple
    };
    
    container.innerHTML = feedback.map(item => {
        const type = item.type === 'app' ? 'mobile' : (item.type || 'unknown');
        const date = item.processed_at || item.timestamp;
        const dateStr = date ? new Date(date).toLocaleDateString() : 'N/A';
        const driverInfo = item.driverId ? `Driver: ${item.driverId}` : (item.metadata?.marshalId ? `Marshal: ${item.metadata.marshalId}` : 'N/A');
        const typeColor = typeColors[type] || '#8B5CF6';
        const sentimentScore = item.sentiment_score || 0;
        const scoreColor = sentimentScore >= 3.5 ? '#10B981' : sentimentScore >= 2.5 ? '#F59E0B' : '#EF4444';
        
        return `
            <div class="feedback-item">
                <div class="feedback-item-info">
                    <span class="feedback-item-type" style="background: ${typeColor};">${type}</span>
                    <div class="feedback-item-comment">${(item.comment || 'No comment').substring(0, 100)}${item.comment?.length > 100 ? '...' : ''}</div>
                    <div class="feedback-item-meta">${dateStr} • ${driverInfo}</div>
                </div>
                <div class="feedback-item-score" style="color: ${scoreColor}; font-weight: 700;">${sentimentScore.toFixed(1)}</div>
            </div>
        `;
    }).join('');
}

// Load analytics page
async function loadAnalyticsPage(type) {
    const contentEl = document.getElementById(`${type}Content`);
    if (!contentEl) return;
    
    contentEl.innerHTML = '<p class="loading">Loading analytics...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/api/analytics/${type}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.statistics) {
            throw new Error('Invalid data format');
        }
        
        contentEl.innerHTML = generateAnalyticsPageHTML(type, data);
        
        // Initialize any charts or interactions
        if (type === 'driver') {
            loadDriverAnalytics(data);
        }
    } catch (error) {
        console.error(`Error loading ${type} analytics:`, error);
        contentEl.innerHTML = `<p class="loading">Error loading analytics: ${error.message}</p>`;
        showToast(`Error loading ${type} analytics`, 'error');
    }
}

// Generate analytics page HTML
function generateAnalyticsPageHTML(type, data) {
    const stats = data.statistics || {};
    const feedback = data.feedback || [];
    
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Feedback</h3>
                <div class="value">${stats.total || 0}</div>
            </div>
            <div class="stat-card">
                <h3>Average Sentiment</h3>
                <div class="value">${(stats.averageSentiment || 0).toFixed(2)}</div>
            </div>
        </div>
        
        <div class="chart-container" style="margin-top: 32px;">
            <h3>Feedback List</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>ID</th>
                        <th>Sentiment</th>
                        <th>Comment</th>
                    </tr>
                </thead>
                <tbody>
                    ${feedback.slice(0, 50).map(item => {
                        const date = new Date(item.processed_at || item.timestamp).toLocaleDateString();
                        return `
                            <tr>
                                <td>${date}</td>
                                <td>${item.driverId || item.tripId || item.metadata?.marshalId || 'N/A'}</td>
                                <td>${(item.sentiment_score || 0).toFixed(2)}</td>
                                <td>${(item.comment || '').substring(0, 50)}${item.comment?.length > 50 ? '...' : ''}</td>
                            </tr>
                        `;
                    }).join('') || '<tr><td colspan="4">No feedback available</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// Load driver-specific analytics
function loadDriverAnalytics(data) {
    // Additional driver-specific visualizations can be added here
}

// Load alerts page
async function loadAlertsPage() {
    const contentEl = document.getElementById('alertsContent');
    if (!contentEl) return;
    
    contentEl.innerHTML = '<p class="loading">Loading alerts...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/api/alerts`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.alerts) {
            throw new Error('Invalid data format');
        }
        
        contentEl.innerHTML = generateAlertsPageHTML(data);
    } catch (error) {
        console.error('Error loading alerts:', error);
        contentEl.innerHTML = `<p class="loading">Error loading alerts: ${error.message}</p>`;
        showToast('Error loading alerts', 'error');
    }
}

// Generate alerts page HTML
function generateAlertsPageHTML(data) {
    const alerts = data.alerts || [];
    const threshold = data.threshold || 2.5;
    
    if (alerts.length === 0) {
        return `
            <div class="no-alerts">
                <h2>✅ No Active Alerts</h2>
                <p>All driver scores are above the threshold (${threshold}).</p>
            </div>
        `;
    }
    
    return `
        <div class="alerts-summary">
            <div class="stat-card alert-card">
                <h3>Active Alerts</h3>
                <div class="value alert-value">${alerts.length}</div>
                <p>Drivers with score below ${threshold}</p>
            </div>
        </div>
        
        <div class="alerts-list">
            <h3>Drivers Requiring Attention</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Driver ID</th>
                        <th>Current Score</th>
                        <th>Threshold</th>
                        <th>Alert Status</th>
                        <th>Cooldown</th>
                    </tr>
                </thead>
                <tbody>
                    ${alerts.map(alert => {
                        const alertStatus = alert.alertTriggered 
                            ? '<span class="alert-badge triggered">Alert Triggered</span>'
                            : '<span class="alert-badge pending">⚠️ Below Threshold</span>';
                        
                        const cooldownText = alert.cooldownMinutes 
                            ? `${alert.cooldownMinutes} min remaining`
                            : 'No cooldown';
                        
                        return `
                            <tr class="alert-row ${alert.alertTriggered ? 'alert-active' : ''}">
                                <td><strong>${alert.driverId}</strong></td>
                                <td>
                                    <span class="score-badge ${alert.score < 2.0 ? 'danger' : 'warning'}">
                                        ${alert.score.toFixed(2)}
                                    </span>
                                </td>
                                <td>${threshold}</td>
                                <td>${alertStatus}</td>
                                <td>${cooldownText}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="alerts-info">
            <h4>About Alerts</h4>
            <ul>
                <li>Alerts are triggered when a driver's sentiment score drops below ${threshold}</li>
                <li>Each alert has a 30-minute cooldown to prevent spam</li>
                <li>Check the worker logs for detailed alert information</li>
                <li>Scores are calculated using EMA (Exponential Moving Average) from feedback sentiment</li>
            </ul>
        </div>
    `;
}

// Load alerts page
async function loadAlertsPage() {
    const contentEl = document.getElementById('alertsContent');
    if (!contentEl) return;
    
    contentEl.innerHTML = '<p class="loading">Loading alerts...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/api/alerts`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.alerts) {
            throw new Error('Invalid data format');
        }
        
        contentEl.innerHTML = generateAlertsPageHTML(data);
    } catch (error) {
        console.error('Error loading alerts:', error);
        contentEl.innerHTML = `<p class="loading">Error loading alerts: ${error.message}</p>`;
        showToast('Error loading alerts', 'error');
    }
}

// Generate alerts page HTML
function generateAlertsPageHTML(data) {
    const alerts = data.alerts || [];
    const threshold = data.threshold || 2.5;
    
    if (alerts.length === 0) {
        return `
            <div class="no-alerts">
                <h2>✅ No Active Alerts</h2>
                <p>All driver scores are above the threshold (${threshold}).</p>
            </div>
        `;
    }
    
    return `
        <div class="alerts-summary">
            <div class="stat-card alert-card">
                <h3>Active Alerts</h3>
                <div class="value alert-value">${alerts.length}</div>
                <p>Drivers with score below ${threshold}</p>
            </div>
        </div>
        
        <div class="alerts-list">
            <h3>Drivers Requiring Attention</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Driver ID</th>
                        <th>Current Score</th>
                        <th>Threshold</th>
                        <th>Alert Status</th>
                        <th>Cooldown</th>
                    </tr>
                </thead>
                <tbody>
                    ${alerts.map(alert => {
                        const alertStatus = alert.alertTriggered 
                            ? '<span class="alert-badge triggered">Alert Triggered</span>'
                            : '<span class="alert-badge pending">⚠️ Below Threshold</span>';
                        
                        const cooldownText = alert.cooldownMinutes 
                            ? `${alert.cooldownMinutes} min remaining`
                            : 'No cooldown';
                        
                        return `
                            <tr class="alert-row ${alert.alertTriggered ? 'alert-active' : ''}">
                                <td><strong>${alert.driverId}</strong></td>
                                <td>
                                    <span class="score-badge ${alert.score < 2.0 ? 'critical' : 'warning'}">
                                        ${alert.score.toFixed(2)}
                                    </span>
                                </td>
                                <td>${threshold}</td>
                                <td>${alertStatus}</td>
                                <td>${cooldownText}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
        
        <div class="alerts-info">
            <h4>About Alerts</h4>
            <ul>
                <li>Alerts are triggered when a driver's sentiment score drops below ${threshold}</li>
                <li>Each alert has a 30-minute cooldown to prevent spam</li>
                <li>Check the worker logs for detailed alert information</li>
                <li>Scores are calculated using EMA (Exponential Moving Average) from feedback sentiment</li>
            </ul>
        </div>
    `;
}

// Refresh functions
function refreshAll() {
    showToast('Refreshing data...', 'info');
    if (currentPage === 'home') {
        loadHomePage();
    } else {
        refreshPage(currentPage);
    }
}

function refreshPage(page) {
    showToast('Refreshing data...', 'info');
    if (page === 'home') {
        loadHomePage();
    } else {
        loadAnalyticsPage(page);
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

