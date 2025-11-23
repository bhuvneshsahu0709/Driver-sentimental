// Landing Page Handler

function redirectToAdmin() {
    // Redirect to login page (which will check auth and redirect to admin)
    window.location.href = '/login.html';
}

// Update login redirect to new admin dashboard
// This will be handled in login.html

function redirectToPassenger() {
    // Redirect to new feedback form
    window.location.href = '/feedback-v2.html';
}

// Make cards clickable (not just buttons)
document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.style.cursor = 'pointer';
        // Add hover effect
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-8px)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
        });
    });
});

// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    // Press '1' for Admin, '2' for Passenger
    if (e.key === '1') {
        redirectToAdmin();
    } else if (e.key === '2') {
        redirectToPassenger();
    }
});

// Add smooth scroll behavior
document.documentElement.style.scrollBehavior = 'smooth';

