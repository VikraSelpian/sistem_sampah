// JavaScript to make navbar link active based on current page
document.addEventListener("DOMContentLoaded", function() {
    const currentLocation = window.location.href; // Get current URL
    const menuItem = document.querySelectorAll('.sidebar ul li a'); // Select all nav links

    menuItem.forEach(link => {
        if (link.href === currentLocation) {
            link.classList.add('active'); // Add active class to the matching link
        }
    });
});